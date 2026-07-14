import { UseGuards } from "@nestjs/common";
import { AdminGuard } from "./admin.guard";

/** Restricts a controller/handler to admin accounts (see {@link AdminGuard}). */
export const AdminOnly = () => UseGuards(AdminGuard);
