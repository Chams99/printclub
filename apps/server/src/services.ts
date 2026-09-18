import { createAuth } from "@PhotoPrinting/auth";
import { createDb } from "@PhotoPrinting/db";

import { ENV } from "./env.server";

export const db = createDb(ENV);
export const auth = createAuth(ENV, db);
