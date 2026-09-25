import { describe, it, expect } from "vitest";

describe("Kiosk Hardening & Cryptographic Integrity", () => {
  // ── 1. CHALLENGE LIFECYCLE & NONCE VALIDATION ──

  function isChallengeValid(challenge, suppliedNonce, currentTime) {
    if (!challenge || !challenge.nonce || !challenge.expiresAt) return false;
    if (challenge.nonce !== suppliedNonce) return false;
    if (currentTime > challenge.expiresAt) return false;
    return true;
  }

  it("accepts a challenge within its 60-second window", () => {
    const issuedAt = 1000000;
    const challenge = { nonce: "nonce_abc_123", expiresAt: issuedAt + 60000 };

    expect(isChallengeValid(challenge, "nonce_abc_123", issuedAt + 10000)).toBe(true);
    expect(isChallengeValid(challenge, "nonce_abc_123", issuedAt + 59999)).toBe(true);
  });

  it("rejects expired challenges to prevent replay attacks (A3)", () => {
    const issuedAt = 1000000;
    const challenge = { nonce: "nonce_abc_123", expiresAt: issuedAt + 60000 };

    expect(isChallengeValid(challenge, "nonce_abc_123", issuedAt + 60001)).toBe(false);
    expect(isChallengeValid(challenge, "nonce_abc_123", issuedAt + 120000)).toBe(false);
  });

  it("rejects mismatched nonces", () => {
    const issuedAt = 1000000;
    const challenge = { nonce: "nonce_correct", expiresAt: issuedAt + 60000 };

    expect(isChallengeValid(challenge, "nonce_wrong", issuedAt + 10000)).toBe(false);
  });

  // ── 2. SINGLE OPEN SHIFT INVARIANT (D2) ──

  function canClockInNewShift(existingShiftsForUser) {
    const hasOpenShift = existingShiftsForUser.some((s) => s.clockOut == null);
    return !hasOpenShift;
  }

  it("allows multiple completed shifts on the same day", () => {
    const shifts = [
      { id: "s1", clockIn: "2026-09-25T01:00:00Z", clockOut: "2026-09-25T03:00:00Z" },
      { id: "s2", clockIn: "2026-09-25T05:00:00Z", clockOut: "2026-09-25T07:00:00Z" },
    ];
    expect(canClockInNewShift(shifts)).toBe(true);
  });

  it("strictly forbids opening a shift when another shift is currently active", () => {
    const shiftsWithOpen = [
      { id: "s1", clockIn: "2026-09-25T01:00:00Z", clockOut: "2026-09-25T03:00:00Z" },
      { id: "s2", clockIn: "2026-09-25T08:00:00Z", clockOut: null },
    ];
    expect(canClockInNewShift(shiftsWithOpen)).toBe(false);
  });

  // ── 3. WEB CRYPTO P-256 SIGNATURE VERIFICATION (D5) ──

  it("generates and verifies native ECDSA P-256 signatures", async () => {
    const keyPair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"]
    );

    const deviceId = "kiosk-front-01";
    const nonce = "test-nonce-456";
    const badgeToken = "ins_rina_42";
    const payload = `${deviceId}:${nonce}:${badgeToken}`;

    const encoder = new TextEncoder();
    const data = encoder.encode(payload);

    // Sign with private key
    const signature = await crypto.subtle.sign(
      { name: "ECDSA", hash: { name: "SHA-256" } },
      keyPair.privateKey,
      data
    );

    // Verify with public key
    const isValid = await crypto.subtle.verify(
      { name: "ECDSA", hash: { name: "SHA-256" } },
      keyPair.publicKey,
      signature,
      data
    );
    expect(isValid).toBe(true);

    // Tampered payload must fail verification
    const tamperedData = encoder.encode(`${deviceId}:${nonce}:ins_forged_99`);
    const isTamperedValid = await crypto.subtle.verify(
      { name: "ECDSA", hash: { name: "SHA-256" } },
      keyPair.publicKey,
      signature,
      tamperedData
    );
    expect(isTamperedValid).toBe(false);
  });

  // ── 4. DEVICE REGISTRATION & REVOCATION (D6) ──

  function isDeviceAuthorized(deviceRecord) {
    return Boolean(deviceRecord && deviceRecord.status === "active" && deviceRecord.publicKeyJwk);
  }

  it("authorizes active provisioned devices and rejects revoked terminals", () => {
    const activeKiosk = {
      deviceId: "kiosk_gto_01",
      status: "active",
      branchId: "kota_gorontalo",
      publicKeyJwk: { kty: "EC", crv: "P-256" },
    };
    const revokedKiosk = {
      ...activeKiosk,
      status: "revoked",
    };

    expect(isDeviceAuthorized(activeKiosk)).toBe(true);
    expect(isDeviceAuthorized(revokedKiosk)).toBe(false);
    expect(isDeviceAuthorized(null)).toBe(false);
  });
});
