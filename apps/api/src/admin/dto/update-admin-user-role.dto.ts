import { IsIn } from "class-validator";
import type { Role, UpdateAdminUserRoleRequestDto } from "@tracklore/shared";
import { Role as RoleValues } from "@tracklore/shared";

export class UpdateAdminUserRoleDto implements UpdateAdminUserRoleRequestDto {
  @IsIn(Object.values(RoleValues))
  role!: Role;
}
