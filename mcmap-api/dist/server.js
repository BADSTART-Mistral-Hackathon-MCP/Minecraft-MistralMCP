import express from "express";
import { z } from "zod";
import { init, setSeed, getBiome, listStructures, blockToChunk } from "./cubiomes.js";
const app = express();
app.use(express.json());
await init(19, false);
app.get("/health", (_req, res) => {
    res.send("ok");
});
const BiomeQuery = z.object({
    seed: z.string(),
    dim: z.coerce.number().int().min(0).max(2),
    x: z.coerce.number().int(),
    z: z.coerce.number().int(),
    y: z.coerce.number().int().optional().default(63),
    scale: z.coerce
        .number()
        .int()
        .refine((v) => [1, 4, 16, 64, 256].includes(v), "scale invalid"),
});
app.get("/api/biome", async (req, res) => {
    const result = BiomeQuery.safeParse(req.query);
    if (!result.success) {
        return res.status(400).json({ error: result.error.flatten() });
    }
    try {
        await setSeed(result.data.seed, result.data.dim);
        const biomeId = await getBiome({
            scale: result.data.scale,
            x: result.data.x,
            z: result.data.z,
            y: result.data.y,
        });
        res.json({ biomeId });
    }
    catch (err) {
        res.status(500).json({ error: err?.message ?? String(err) });
    }
});
const StructBboxQuery = z.object({
    seed: z.string(),
    dim: z.coerce.number().int().min(0).max(2),
    typeId: z.coerce.number().int(),
    x0: z.coerce.number().int(),
    z0: z.coerce.number().int(),
    x1: z.coerce.number().int(),
    z1: z.coerce.number().int(),
    max: z.coerce.number().int().optional().default(500),
});
app.get("/api/structures", async (req, res) => {
    const result = StructBboxQuery.safeParse(req.query);
    if (!result.success) {
        return res.status(400).json({ error: result.error.flatten() });
    }
    try {
        const minChunkX = blockToChunk(Math.min(result.data.x0, result.data.x1));
        const maxChunkX = blockToChunk(Math.max(result.data.x0, result.data.x1));
        const minChunkZ = blockToChunk(Math.min(result.data.z0, result.data.z1));
        const maxChunkZ = blockToChunk(Math.max(result.data.z0, result.data.z1));
        const items = await listStructures({
            typeId: result.data.typeId,
            seed: result.data.seed,
            dim: result.data.dim,
            minChunkX,
            minChunkZ,
            maxChunkX,
            maxChunkZ,
            max: result.data.max,
        });
        res.json({ count: items.length, items });
    }
    catch (err) {
        res.status(500).json({ error: err?.message ?? String(err) });
    }
});
const StructAroundQuery = z.object({
    seed: z.string(),
    dim: z.coerce.number().int().min(0).max(2),
    typeId: z.coerce.number().int(),
    cx: z.coerce.number().int(),
    cz: z.coerce.number().int(),
    radius: z.coerce.number().int().positive().default(2048),
    max: z.coerce.number().int().optional().default(500),
});
app.get("/api/structures/around", async (req, res) => {
    const result = StructAroundQuery.safeParse(req.query);
    if (!result.success) {
        return res.status(400).json({ error: result.error.flatten() });
    }
    try {
        const x0 = result.data.cx - result.data.radius;
        const z0 = result.data.cz - result.data.radius;
        const x1 = result.data.cx + result.data.radius;
        const z1 = result.data.cz + result.data.radius;
        const minChunkX = blockToChunk(Math.min(x0, x1));
        const maxChunkX = blockToChunk(Math.max(x0, x1));
        const minChunkZ = blockToChunk(Math.min(z0, z1));
        const maxChunkZ = blockToChunk(Math.max(z0, z1));
        const items = await listStructures({
            typeId: result.data.typeId,
            seed: result.data.seed,
            dim: result.data.dim,
            minChunkX,
            minChunkZ,
            maxChunkX,
            maxChunkZ,
            max: result.data.max,
        });
        res.json({
            center: { x: result.data.cx, z: result.data.cz },
            radius: result.data.radius,
            count: items.length,
            items,
        });
    }
    catch (err) {
        res.status(500).json({ error: err?.message ?? String(err) });
    }
});
const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
    console.log(`-> http://127.0.0.1:${port}`);
});
