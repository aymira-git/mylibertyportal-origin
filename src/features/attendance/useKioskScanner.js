import { useState, useEffect } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { getInstantPunctuality } from ".";
import {
  kioskClockInWithProof,
  clockOutShift,
  switchClassAtomic,
} from "./shiftsRepository";
import { soundEffects } from "./soundEffects";
import { triggerHaptic } from "../shared";
import { handleKioskScan } from "./kioskScanProcessor";

export function useKioskScanner({ studentsOnly = false, staffOnly = false } = {}) {
  const [kioskScanning, setKioskScanning] = useState(false);
  const [pendingClockIn, setPendingClockIn] = useState(null);
  const [pendingTransition, setPendingTransition] = useState(null);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [nextClassId, setNextClassId] = useState("");
  const [status, setStatus] = useState({ message: "", type: "", detail: "", personName: "" });
  const [lastScanned, setLastScanned] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Real-time digital clock display
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const showStatus = (message, type = "success", detail = "", personName = "") => {
    setStatus({ message, type, detail, personName });
    if (type === "success") {
      soundEffects.playSuccess();
      triggerHaptic("success");
    } else if (type === "info") {
      // Info notices: gentle display without error sound or vibration
    } else {
      soundEffects.playError();
      triggerHaptic("error");
    }
    // Auto-clear after 4.5 seconds
    setTimeout(() => {
      setStatus({ message: "", type: "", detail: "", personName: "" });
    }, 4500);
  };

  const cancelPendingClockIn = () => {
    setPendingClockIn(null);
    setSelectedClassId("");
  };

  const cancelPendingTransition = () => {
    setPendingTransition(null);
    setNextClassId("");
  };

  const createShift = async () => {
    if (!pendingClockIn) return;
    const isEvent =
      pendingClockIn.matchedEvent &&
      selectedClassId === `corporate_event:${pendingClockIn.matchedEvent.id}`;
    const selectedClass = isEvent
      ? null
      : pendingClockIn.classes.find((cls) => cls.id === selectedClassId);

    if (!isEvent && !selectedClass) return;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      showStatus(
        "Kiosk Offline",
        "error",
        "Cannot clock in while offline. Please reconnect to branch Wi-Fi.",
        pendingClockIn?.userData?.displayName || ""
      );
      return;
    }

    try {
      const clockInAt = new Date();
      const isLeave = (pendingClockIn.userData.status || "active") === "on_leave";
      const name = pendingClockIn.userData.displayName;

      if (isEvent) {
        const event = pendingClockIn.matchedEvent;
        await kioskClockInWithProof({
          badgeToken: pendingClockIn.uid,
          classId: `corporate_event:${event.id}`,
          className: event.name,
          shiftType: "corporate_event",
          eventId: event.id,
          punctuality: {
            status: "Present",
            scheduledStart: null,
            requiredArrival: null,
            minutesEarlyOrLate: 0,
          },
        });

        cancelPendingClockIn();
        showStatus(
          isLeave ? "Event Duty Started (On Leave)" : "Event Duty Started",
          "success",
          isLeave
            ? `Clocked in for ${event.name} (Note: Marked on Leave).`
            : `Clocked in for ${event.name}.`,
          name
        );
        return setLastScanned({
          name,
          role: pendingClockIn.userData.role,
          time: new Date(),
          type: `Clock In (${event.name})`,
        });
      }

      const punctuality = getInstantPunctuality(selectedClass, clockInAt);

      await kioskClockInWithProof({
        badgeToken: pendingClockIn.uid,
        classId: selectedClass.id,
        className: selectedClass.className,
        punctuality,
      });

      cancelPendingClockIn();
      showStatus(
        isLeave ? "Shift Confirmed (On Leave)" : "Shift Confirmed",
        "success",
        `Clocked in for ${selectedClass.className} (${punctuality.status})${isLeave ? " - Note: Marked on Leave" : ""}`,
        name
      );
      setLastScanned({
        name,
        role: pendingClockIn.userData.role,
        time: new Date(),
        type: "Clock In",
      });
    } catch (err) {
      showStatus("Clock-in Error", "error", err.message);
    }
  };

  const switchToNextClass = async () => {
    const nextClass = pendingTransition?.remainingClasses.find((cls) => cls.id === nextClassId);
    if (!pendingTransition || !nextClass) return;
    try {
      const now = new Date();
      const punctuality = getInstantPunctuality(nextClass, now);

      await switchClassAtomic({
        previousShiftId: pendingTransition.openShift.id,
        clockOutAt: now,
        uid: pendingTransition.uid,
        displayName: pendingTransition.userData.displayName,
        role: pendingTransition.userData.role,
        classId: nextClass.id,
        className: nextClass.className,
        punctuality,
      });

      const name = pendingTransition.userData.displayName;
      showStatus(
        "Class Switched",
        "success",
        `Transitioned to ${nextClass.className} (${punctuality.status})`,
        name
      );
      setLastScanned({
        name,
        role: pendingTransition.userData.role,
        time: new Date(),
        type: "Switched",
      });
    } catch (err) {
      showStatus("Transition Error", "error", err.message);
    } finally {
      cancelPendingTransition();
    }
  };

  const clockOutOnly = async () => {
    if (!pendingTransition) return;
    try {
      await clockOutShift(pendingTransition.openShift.id);
      const name = pendingTransition.userData.displayName;
      showStatus("Clocked Out", "success", "Shift completed and archived.", name);
      setLastScanned({
        name,
        role: pendingTransition.userData.role,
        time: new Date(),
        type: "Clock Out",
      });
    } catch (err) {
      showStatus("Clock-out Error", "error", err.message);
    } finally {
      cancelPendingTransition();
    }
  };

  useEffect(() => {
    if (!kioskScanning) return;
    const scanner = new Html5QrcodeScanner(
      "kiosk-reader",
      {
        fps: 10,
        qrbox: { width: 260, height: 260 },
        aspectRatio: 1.0,
      },
      /* verbose= */ false
    );

    scanner.render(
      async (uid) => {
        scanner.clear();
        setKioskScanning(false);
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          showStatus(
            "Kiosk Offline",
            "error",
            "Network required for attendance scanning. Reconnect to branch Wi-Fi."
          );
          return;
        }
        try {
          await handleKioskScan(uid, {
            studentsOnly,
            staffOnly,
            showStatus,
            setLastScanned,
            setPendingClockIn,
            setPendingTransition,
          });
        } catch (err) {
          showStatus("Scanner Error", "error", err.message);
        }
      },
      () => {}
    );
    return () => {
      try {
        scanner.clear();
      } catch {
        // Safe unmount
      }
    };
  }, [kioskScanning, studentsOnly, staffOnly]);

  return {
    kioskScanning,
    setKioskScanning,
    pendingClockIn,
    cancelPendingClockIn,
    pendingTransition,
    cancelPendingTransition,
    selectedClassId,
    setSelectedClassId,
    nextClassId,
    setNextClassId,
    status,
    lastScanned,
    currentTime,
    createShift,
    switchToNextClass,
    clockOutOnly,
  };
}
