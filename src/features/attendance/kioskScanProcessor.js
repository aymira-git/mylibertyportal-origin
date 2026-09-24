import { isShiftStale, autoCloseShift, getTodaysClasses } from ".";
import {
  fetchUserById,
  fetchOpenShiftFor,
  fetchInstructorClasses,
  clockIn,
  clockOutShift,
  recordStudentAttendance,
} from "./shiftsRepository";
import { isKindergartenDivision } from "../../constants/divisions.js";
import { getTodayWitaWeekday, todayWita } from "../../utils/dateWita.js";
import { fetchActiveCorporateEventsForDate } from "./corporateEventsRepository";
import { findMatchingCorporateEvents } from "./corporateEvents";

/**
 * Core business resolution for QR badge scan at the kiosk station.
 * Evaluates role, permissions, status, corporate events, and shifts.
 */
export async function handleKioskScan(
  uid,
  {
    studentsOnly = false,
    staffOnly = false,
    showStatus,
    setLastScanned,
    setPendingClockIn,
    setPendingTransition,
  }
) {
  const rawId = typeof uid === "string" ? uid.trim() : "";
  if (!rawId || rawId.includes("/") || rawId.length < 5) {
    return showStatus(
      "Invalid Pass",
      "error",
      "The scanned QR code is not a recognized MY LIBERTY badge."
    );
  }
  const userData = await fetchUserById(rawId);
  if (!userData) {
    return showStatus(
      "Invalid Pass",
      "error",
      "No user profile found matching this QR badge."
    );
  }

  if (studentsOnly && userData.role !== "student") {
    return showStatus(
      "Restricted Kiosk",
      "error",
      "This station only accepts student identification passes."
    );
  }
  if (staffOnly && userData.role === "student") {
    return showStatus(
      "Staff Only",
      "error",
      "This station is dedicated to staff clock-in and instructor shifts."
    );
  }

  if (userData.role === "student") {
    const studentStatus = userData.status || "active";
    if (studentStatus === "inactive" || studentStatus === "graduated") {
      return showStatus(
        "Pass Inactive",
        "error",
        studentStatus === "graduated"
          ? "This student has graduated. Please contact the administration."
          : "This student pass is inactive. Please contact the front office.",
        userData.displayName
      );
    }

    const todayDate = todayWita();
    const activeEvents = await fetchActiveCorporateEventsForDate(todayDate);
    const { match: matchedEvent } = findMatchingCorporateEvents(
      activeEvents,
      userData,
      todayDate
    );

    await recordStudentAttendance({
      uid,
      displayName: userData.displayName,
      dateKey: todayDate,
      eventId: matchedEvent ? matchedEvent.id : null,
      eventName: matchedEvent ? matchedEvent.name : null,
    });

    const isLeave = studentStatus === "on_leave";
    const eventSuffix = matchedEvent ? ` · Attending: ${matchedEvent.name}` : "";
    showStatus(
      isLeave ? "Attendance Recorded (On Leave)" : "Attendance Recorded",
      "success",
      isLeave
        ? `Welcome back! Note: Your profile is currently marked on leave.${eventSuffix}`
        : `Welcome to My Liberty! Have a great learning session.${eventSuffix}`,
      userData.displayName
    );
    setLastScanned({
      name: userData.displayName,
      role: "student",
      time: new Date(),
      type: matchedEvent ? `Check-in (${matchedEvent.name})` : "Check-in",
    });
  } else {
    const staffStatus = userData.status || "active";
    if (staffStatus === "resigned" || staffStatus === "terminated") {
      return showStatus(
        "Badge Deactivated",
        "error",
        "This staff badge is no longer active. Please contact academy administration.",
        userData.displayName
      );
    }

    const isKindergartenStaff = isKindergartenDivision(userData.division);
    const todayWitaDay = getTodayWitaWeekday();
    const todayDate = todayWita();
    const activeEvents = await fetchActiveCorporateEventsForDate(todayDate);
    const { match: matchedEvent } = findMatchingCorporateEvents(
      activeEvents,
      userData,
      todayDate
    );

    if (isKindergartenStaff && (todayWitaDay === 0 || todayWitaDay === 6)) {
      // Kindergarten is closed on weekends unless a matching corporate event is active today
      if (!matchedEvent) {
        return showStatus(
          "Weekend Off",
          "info",
          "Kids School (Kindergarten) is closed on weekends (Saturday & Sunday). Shifts operate Monday to Friday.",
          userData.displayName
        );
      }
    }

    let openShift = await fetchOpenShiftFor(uid);
    if (openShift && isShiftStale(openShift)) {
      await autoCloseShift(openShift);
      openShift = null;
    }

    if (!openShift) {
      if (userData.role === "instructor") {
        const instructorClasses = await fetchInstructorClasses(uid);
        const todayClasses = getTodaysClasses(instructorClasses);

        if (todayClasses.length > 0) {
          return setPendingClockIn({ uid, userData, classes: todayClasses, matchedEvent });
        }

        // Instructor has no classes scheduled today.
        // Check if an active corporate event matches.
        if (matchedEvent) {
          await clockIn({
            uid,
            displayName: userData.displayName,
            role: userData.role,
            branch: userData.branch,
            branchId: userData.branchId,
            classId: `corporate_event:${matchedEvent.id}`,
            className: matchedEvent.name,
            clockInAt: new Date(),
            shiftType: "corporate_event",
            eventId: matchedEvent.id,
            punctuality: {
              status: "Present",
              scheduledStart: null,
              requiredArrival: null,
              minutesEarlyOrLate: 0,
            },
          });
          const isLeave = staffStatus === "on_leave";
          showStatus(
            isLeave ? "Event Duty Started (On Leave)" : "Event Duty Started",
            "success",
            isLeave
              ? `Clocked in for ${matchedEvent.name} (Note: Marked on Leave).`
              : `Clocked in for ${matchedEvent.name}.`,
            userData.displayName
          );
          return setLastScanned({
            name: userData.displayName,
            role: userData.role,
            time: new Date(),
            type: `Clock In (${matchedEvent.name})`,
          });
        }

        return showStatus(
          "No Class Scheduled",
          "error",
          "You have no classes scheduled today. If you are substituting, please ask an administrator to assign you to the class first.",
          userData.displayName
        );
      }

      // Non-instructor staff (manager, frontoffice, marketing, officeboy, admin):
      if (matchedEvent) {
        await clockIn({
          uid,
          displayName: userData.displayName,
          role: userData.role,
          branch: userData.branch,
          branchId: userData.branchId,
          classId: `corporate_event:${matchedEvent.id}`,
          className: matchedEvent.name,
          clockInAt: new Date(),
          shiftType: "corporate_event",
          eventId: matchedEvent.id,
          punctuality: {
            status: "Present",
            scheduledStart: null,
            requiredArrival: null,
            minutesEarlyOrLate: 0,
          },
        });
        const isLeave = staffStatus === "on_leave";
        showStatus(
          isLeave ? "Event Duty Started (On Leave)" : "Event Duty Started",
          "success",
          isLeave
            ? `Clocked in for ${matchedEvent.name} (Note: Marked on Leave).`
            : `Clocked in for ${matchedEvent.name}.`,
          userData.displayName
        );
        setLastScanned({
          name: userData.displayName,
          role: userData.role,
          time: new Date(),
          type: `Clock In (${matchedEvent.name})`,
        });
      } else {
        // 0 or ambiguous matches (>1) -> Fall back to General Duty
        await clockIn({
          uid,
          displayName: userData.displayName,
          role: userData.role,
          branch: userData.branch,
          branchId: userData.branchId,
          classId: "general",
          className: "General Duty",
          clockInAt: new Date(),
          punctuality: {
            status: "Present",
            scheduledStart: null,
            requiredArrival: null,
            minutesEarlyOrLate: 0,
          },
        });
        const isLeave = staffStatus === "on_leave";
        showStatus(
          isLeave ? "Duty Started (On Leave)" : "Duty Started",
          "success",
          isLeave
            ? "Clocked in on General Administrative Duty (Note: Marked on Leave)."
            : "Clocked in on General Administrative Duty.",
          userData.displayName
        );
        setLastScanned({
          name: userData.displayName,
          role: userData.role,
          time: new Date(),
          type: "Clock In",
        });
      }
    } else {
      if (userData.role === "instructor") {
        const instructorClasses = await fetchInstructorClasses(uid);
        const todayClasses = getTodaysClasses(instructorClasses);
        const remainingClasses = todayClasses.filter((cls) => cls.id !== openShift.classId);

        if (remainingClasses.length > 0) {
          return setPendingTransition({ uid, userData, openShift, remainingClasses });
        }
      }

      await clockOutShift(openShift.id);
      showStatus(
        "Shift Concluded",
        "success",
        openShift.shiftType === "corporate_event"
          ? `Thank you for attending ${openShift.className}!`
          : userData.role === "instructor"
            ? "Thank you for teaching today!"
            : "Thank you for your hard work today!",
        userData.displayName
      );
      setLastScanned({
        name: userData.displayName,
        role: userData.role,
        time: new Date(),
        type: "Clock Out",
      });
    }
  }
}
