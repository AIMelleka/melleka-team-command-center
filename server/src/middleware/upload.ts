import multer from "multer";
import fs from "fs/promises";
import type { AuthRequest } from "./auth.js";
import type { Request } from "express";

const storage = multer.diskStorage({
  destination: (req: Request, _file, cb) => {
    const authReq = req as AuthRequest;
    const slug = (authReq.memberName ?? "unknown").toLowerCase().replace(/\s+/g, "-");
    const dir = `/tmp/${slug}/uploads`;
    fs.mkdir(dir, { recursive: true })
      .then(() => cb(null, dir))
      .catch((err) => cb(err, dir));
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024, files: 10 },
});
