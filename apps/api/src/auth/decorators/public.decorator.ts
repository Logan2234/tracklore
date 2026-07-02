import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/** Marks a route as reachable without a JWT (auth endpoints, health…). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
