import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthEnabled } from "@/lib/auth/password";

/**
 * Whether the requester may edit (create/update/delete sub-resources of) a
 * given vehicle. Viewing is always shared — this only gates writes.
 *
 * Inert in local/Electron mode (no per-user restrictions there at all).
 * In server mode: admins can edit everything; anyone else needs to be the
 * vehicle's creator or hold an explicit VehicleAccess grant from an admin.
 */
export async function canEditVehicle(req: NextRequest, vehicleId: string): Promise<boolean> {
  if (!isAuthEnabled()) return true;

  const role = req.headers.get("x-user-role");
  if (role === "admin") return true;

  const userId = req.headers.get("x-user-id");
  if (!userId) return false;

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { createdByUserId: true },
  });
  if (!vehicle) return false;
  if (vehicle.createdByUserId === userId) return true;

  const grant = await prisma.vehicleAccess.findUnique({
    where: { vehicleId_userId: { vehicleId, userId } },
  });
  return !!grant;
}

/** Standard 403 body for routes that fail the canEditVehicle check. */
export const VEHICLE_ACCESS_DENIED = { error: "You don't have edit access to this vehicle" } as const;
