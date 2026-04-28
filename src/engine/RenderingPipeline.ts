import type { Scene } from "@babylonjs/core/scene";
import type { Camera } from "@babylonjs/core/Cameras/camera";
import "@babylonjs/core/Rendering/prePassRendererSceneComponent";
import "@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderPipelineManagerSceneComponent";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";
import { SSAO2RenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssao2RenderingPipeline";
import { ColorCurves } from "@babylonjs/core/Materials/colorCurves";

/**
 * The single biggest "looks beautiful" lever in the project.
 * Stack: tone mapping → bloom → DoF (subtle) → sharpening → vignette → grain → FXAA, plus SSAO.
 */
export function configureRenderingPipeline(scene: Scene, camera: Camera) {
  const pipeline = new DefaultRenderingPipeline("default", true, scene, [camera]);

  pipeline.samples = 4;
  pipeline.fxaaEnabled = true;

  pipeline.imageProcessingEnabled = true;
  pipeline.imageProcessing.toneMappingEnabled = true;
  pipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  pipeline.imageProcessing.exposure = 1.30;
  pipeline.imageProcessing.contrast = 1.18;
  // Stylized punch via parametric color curves — boost saturation across
  // tonal ranges, slightly cool shadows, slightly warm highlights so the
  // sky and rim-light pop while leaves stay readable. Acts like a LUT
  // without needing a texture asset.
  const curves = new ColorCurves();
  curves.globalSaturation = 60;
  curves.globalDensity = 25;
  curves.shadowsSaturation = 35;
  curves.shadowsHue = 220; // cool blue tint in shadows
  curves.shadowsDensity = 35;
  curves.midtonesSaturation = 50;
  curves.highlightsSaturation = 55;
  curves.highlightsHue = 35; // warm tint in highlights
  curves.highlightsDensity = 20;
  pipeline.imageProcessing.colorCurves = curves;
  pipeline.imageProcessing.colorCurvesEnabled = true;

  pipeline.imageProcessing.vignetteEnabled = true;
  pipeline.imageProcessing.vignetteWeight = 2.2;
  pipeline.imageProcessing.vignetteStretch = 0.5;

  pipeline.bloomEnabled = true;
  pipeline.bloomThreshold = 0.78;
  pipeline.bloomWeight = 0.55;
  pipeline.bloomKernel = 96;
  pipeline.bloomScale = 0.5;

  pipeline.sharpenEnabled = true;
  pipeline.sharpen.edgeAmount = 0.25;
  pipeline.sharpen.colorAmount = 1.0;

  pipeline.grainEnabled = true;
  pipeline.grain.intensity = 6;
  pipeline.grain.animated = true;

  pipeline.chromaticAberrationEnabled = true;
  pipeline.chromaticAberration.aberrationAmount = 8;

  // Try to enable SSAO. If GPU/extension support is missing, swallow the failure.
  try {
    const ssao = new SSAO2RenderingPipeline("ssao", scene, 0.75, [camera]);
    ssao.totalStrength = 0.7;
    ssao.radius = 1.2;
    ssao.expensiveBlur = false;
    ssao.samples = 8;
    ssao.maxZ = 100;
  } catch (e) {
    console.warn("SSAO2 unavailable on this GPU; continuing without it.", e);
  }

  return pipeline;
}
