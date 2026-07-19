-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mobileNavShortcuts" TEXT[] DEFAULT ARRAY['home', 'search', 'menu', 'calendar', 'account']::TEXT[];
