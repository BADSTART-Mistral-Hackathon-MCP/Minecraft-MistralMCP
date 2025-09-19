import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type Dimension = 0 | 1 | 2;
export type StructureTypeId = number;

const U64_MASK = (1n << 64n) - 1n;
export function normalizeSeed(seed: string | number | bigint): bigint {
  return BigInt.asUintN(64, BigInt(seed)) & U64_MASK;
}

type CubiomesModule = {
  _cw_init(mc_version: number, large_biomes: number): void;
  _cw_set_seed(seed: bigint, dim: number): void;
  _cw_get_biome(scale: number, x: number, y: number, z: number): number;
  _cw_gen_biomes_to_buf(
    scale: number,
    x: number,
    z: number,
    width: number,
    height: number,
    y: number,
    outPtr: number
  ): number;
  _cw_list_structures(
    type: number,
    minChunkX: number,
    minChunkZ: number,
    maxChunkX: number,
    maxChunkZ: number,
    outPtr: number,
    maxCount: number
  ): number;
  _malloc(size: number): number;
  _free(ptr: number): void;
  HEAP32: Int32Array & { buffer: ArrayBuffer };
  HEAPU8: Uint8Array & { buffer: ArrayBuffer };
  wasmMemory: WebAssembly.Memory;
};

let moduleInstance: CubiomesModule | null = null;

export async function loadModule(): Promise<CubiomesModule> {
  if (moduleInstance) return moduleInstance;

  const jsPath = path.join(__dirname, "../cubiomes/cubiomes.js");
  const factory = (await import(pathToFileURL(jsPath).href)).default as (
    opts: Record<string, unknown>
  ) => Promise<CubiomesModule>;

  moduleInstance = await factory({
    locateFile: (p: string) => path.join(__dirname, "../cubiomes", p),
  });

  return moduleInstance;
}

export async function init(mcVersion = 19, largeBiomes = false) {
  const m = await loadModule();
  m._cw_init(mcVersion, largeBiomes ? 1 : 0);
  return m;
}

export async function setSeed(seed: string | number | bigint, dim: Dimension) {
  const m = await loadModule();
  m._cw_set_seed(normalizeSeed(seed), dim);
}

export async function getBiome(params: {
  scale: 1 | 4 | 16 | 64 | 256;
  x: number;
  z: number;
  y?: number;
}) {
  const m = await loadModule();
  const y = params.y ?? 63;
  return m._cw_get_biome(params.scale, params.x, y, params.z);
}

export async function genBiomesPatch(params: {
  scale: 1 | 4 | 16 | 64 | 256;
  x: number;
  z: number;
  width: number;
  height: number;
  y?: number;
}): Promise<Int32Array> {
  const m = await loadModule();
  const y = params.y ?? 63;
  const len = params.width * params.height;
  const ptr = m._malloc(len * 4);
  const count = m._cw_gen_biomes_to_buf(
    params.scale,
    params.x,
    params.z,
    params.width,
    params.height,
    y,
    ptr
  );
  const out = new Int32Array(m.HEAP32.buffer, ptr, count).slice();
  m._free(ptr);
  return out;
}

export async function listStructures(args: {
  typeId: StructureTypeId;
  seed: string | number | bigint;
  dim: Dimension;
  minChunkX: number;
  minChunkZ: number;
  maxChunkX: number;
  maxChunkZ: number;
  max?: number;
}): Promise<{ x: number; z: number }[]> {
  const m = await loadModule();
  m._cw_set_seed(normalizeSeed(args.seed), args.dim);

  const max = Math.max(0, Math.min(args.max ?? 1000, 5000));
  const ptr = m._malloc(max * 2 * 4);
  const count = m._cw_list_structures(
    args.typeId,
    args.minChunkX,
    args.minChunkZ,
    args.maxChunkX,
    args.maxChunkZ,
    ptr,
    max
  );

  const raw = new Int32Array(m.HEAP32.buffer, ptr, count * 2).slice();
  m._free(ptr);

  const out: { x: number; z: number }[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ x: raw[i * 2], z: raw[i * 2 + 1] });
  }
  return out;
}

export function blockToChunk(block: number) {
  return Math.floor(block / 16);
}
