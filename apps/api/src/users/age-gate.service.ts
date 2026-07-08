import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { isAdult } from "./age.util";

/** Whether a user may see 18+ titles: opted in AND actually 18+. */
@Injectable()
export class AgeGateService {
  constructor(private readonly prisma: PrismaService) {}

  async allowsAdultContent(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { birthDate: true, allowAdultContent: true },
    });
    return !!user?.allowAdultContent && isAdult(user.birthDate);
  }
}
