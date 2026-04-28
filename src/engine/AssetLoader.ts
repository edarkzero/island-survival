import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import type { Scene } from "@babylonjs/core/scene";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";

const cache = new Map<string, Promise<AbstractMesh[]>>();

/**
 * Cached glTF/.glb loader. Once Quaternius/Kenney assets are dropped into
 * /public/assets/models, call loadGlb("/assets/models/.../tree.glb", scene).
 * The .glb format is the long-term portable choice — it imports directly into
 * Unity and Unreal too.
 */
export function loadGlb(url: string, scene: Scene): Promise<AbstractMesh[]> {
  const existing = cache.get(url);
  if (existing) return existing;

  const lastSlash = url.lastIndexOf("/");
  const rootUrl = url.slice(0, lastSlash + 1);
  const file = url.slice(lastSlash + 1);

  const promise = SceneLoader.ImportMeshAsync("", rootUrl, file, scene).then(
    (result) => result.meshes,
  );
  cache.set(url, promise);
  return promise;
}
