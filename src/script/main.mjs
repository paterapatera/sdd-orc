#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runCliResult } from "./engine.mjs";

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) process.exit(runCliResult(process.cwd(), process.argv.slice(2)));
