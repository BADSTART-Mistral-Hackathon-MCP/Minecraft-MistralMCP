import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const U64_MASK = (1n << 64n) - 1n;
export function normalizeSeed(seed) {
    return BigInt.asUintN(64, BigInt(seed)) & U64_MASK;
}
let moduleInstance = null;
export async function loadModule() {
    if (moduleInstance)
        return moduleInstance;
    const jsPath = path.join(__dirname, "../cubiomes/cubiomes.js");
    const factory = (await import(pathToFileURL(jsPath).href)).default;
    moduleInstance = await factory({
        locateFile: (p) => path.join(__dirname, "../cubiomes", p),
    });
    return moduleInstance;
}
export async function init(mcVersion = 19, largeBiomes = false) {
    const m = await loadModule();
    m._cw_init(mcVersion, largeBiomes ? 1 : 0);
    return m;
}
export async function setSeed(seed, dim) {
    const m = await loadModule();
    m._cw_set_seed(normalizeSeed(seed), dim);
}
export async function getBiome(params) {
    const m = await loadModule();
    const y = params.y ?? 63;
    return m._cw_get_biome(params.scale, params.x, y, params.z);
}
export async function genBiomesPatch(params) {
    const m = await loadModule();
    const y = params.y ?? 63;
    const len = params.width * params.height;
    const ptr = m._malloc(len * 4);
    const count = m._cw_gen_biomes_to_buf(params.scale, params.x, params.z, params.width, params.height, y, ptr);
    const out = new Int32Array(m.HEAP32.buffer, ptr, count).slice();
    m._free(ptr);
    return out;
}
export async function listStructures(args) {
    const m = await loadModule();
    m._cw_set_seed(normalizeSeed(args.seed), args.dim);
    const max = Math.max(0, Math.min(args.max ?? 1000, 5000));
    const ptr = m._malloc(max * 2 * 4);
    const count = m._cw_list_structures(args.typeId, args.minChunkX, args.minChunkZ, args.maxChunkX, args.maxChunkZ, ptr, max);
    const raw = new Int32Array(m.HEAP32.buffer, ptr, count * 2).slice();
    m._free(ptr);
    const out = [];
    for (let i = 0; i < count; i++) {
        out.push({ x: raw[i * 2], z: raw[i * 2 + 1] });
    }
    return out;
}
export function blockToChunk(block) {
    return Math.floor(block / 16);
}
