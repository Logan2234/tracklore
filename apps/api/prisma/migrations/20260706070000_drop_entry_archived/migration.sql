-- Drop the unused `archived` column: entry status + filters cover its purpose.
ALTER TABLE "LibraryEntry" DROP COLUMN "archived";
