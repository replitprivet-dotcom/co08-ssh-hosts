import type { VercelRequest, VercelResponse } from "@vercel/node";
import { renderBootstrapScript } from "../../server/hostService.js";

export default function handler(req: VercelRequest, res: VercelResponse) { const host = req.headers.host || "co08.art"; const protocol = String(req.headers["x-forwarded-proto"] || "https"); const secret = String(req.query.secret || ""); res.setHeader("content-type", "text/plain; charset=utf-8"); res.status(200).send(renderBootstrapScript(`${protocol}://${host}`, secret)); }
