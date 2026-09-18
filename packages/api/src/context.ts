import type { Session } from "@PhotoPrinting/auth";
import type { Database } from "@PhotoPrinting/db";

export type Context = {
  session: Session | null;
  db: Database;
};
