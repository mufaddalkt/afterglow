/** A small, dependency-free HDR bloom pipeline. All intermediate buffers stay linear. */
export class CinematicFX {
  constructor(THREE, renderer) {
    this.THREE = THREE;
    this.renderer = renderer;
    this.enabled = false;
    this.disposed = false;
    this.resources = [];
    try {
      // Rendering half floats needs this extension even in WebGL 2.
      if (renderer.extensions && !renderer.extensions.has('EXT_color_buffer_float')) {
        throw new Error('HDR color buffers are unavailable');
      }
      const vertexShader = `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `;
      const target = depthBuffer => {
        const value = new THREE.WebGLRenderTarget(1, 1, {
          type: THREE.HalfFloatType,
          format: THREE.RGBAFormat,
          minFilter: THREE.LinearFilter,
          magFilter: THREE.LinearFilter,
          depthBuffer,
          stencilBuffer: false,
          generateMipmaps: false,
          colorSpace: THREE.LinearSRGBColorSpace,
        });
        value.texture.colorSpace = THREE.LinearSRGBColorSpace;
        this.resources.push(value);
        return value;
      };
      this.sceneTarget = target(true);
      this.bloomA = target(false);
      this.bloomB = target(false);
      const material = (uniforms, fragmentShader) => {
        const value = new THREE.ShaderMaterial({
          uniforms,
          vertexShader,
          fragmentShader,
          depthTest: false,
          depthWrite: false,
          toneMapped: false,
          blending: THREE.NoBlending,
        });
        this.resources.push(value);
        return value;
      };
      this.extract = material({
        tScene: { value: this.sceneTarget.texture },
        texel: { value: new THREE.Vector2() },
      }, `
        uniform sampler2D tScene;
        uniform vec2 texel;
        varying vec2 vUv;
        void main() {
          // Four taps keep subpixel streetlights stable while downsampling.
          vec3 c = texture2D(tScene, vUv + texel * vec2(-1.0, -1.0)).rgb;
          c += texture2D(tScene, vUv + texel * vec2(1.0, -1.0)).rgb;
          c += texture2D(tScene, vUv + texel * vec2(-1.0, 1.0)).rgb;
          c += texture2D(tScene, vUv + texel * vec2(1.0, 1.0)).rgb;
          c *= 0.25;
          float brightness = max(c.r, max(c.g, c.b));
          float soft = clamp(brightness - 0.7, 0.0, 0.8);
          soft = soft * soft / 1.60001;
          float contribution = max(soft, brightness - 1.1) / max(brightness, 0.0001);
          gl_FragColor = vec4(min(c * contribution, vec3(14.0)), 1.0);
        }
      `);
      this.blur = material({
        tInput: { value: this.bloomA.texture },
        direction: { value: new THREE.Vector2() },
      }, `
        uniform sampler2D tInput;
        uniform vec2 direction;
        varying vec2 vUv;
        void main() {
          // Nine-tap Gaussian reduced to five bilinear fetches.
          vec3 c = texture2D(tInput, vUv).rgb * 0.2270270270;
          c += texture2D(tInput, vUv + direction * 1.3846153846).rgb * 0.3162162162;
          c += texture2D(tInput, vUv - direction * 1.3846153846).rgb * 0.3162162162;
          c += texture2D(tInput, vUv + direction * 3.2307692308).rgb * 0.0702702703;
          c += texture2D(tInput, vUv - direction * 3.2307692308).rgb * 0.0702702703;
          gl_FragColor = vec4(c, 1.0);
        }
      `);
      this.composite = material({
        tScene: { value: this.sceneTarget.texture },
        tBloom: { value: this.bloomA.texture },
        boost: { value: 0 },
        velocity: { value: 0 },
        exposure: { value: renderer.toneMappingExposure || 1 },
        clock: { value: 0 },
      }, `
        uniform sampler2D tScene;
        uniform sampler2D tBloom;
        uniform float boost;
        uniform float velocity;
        uniform float exposure;
        uniform float clock;
        varying vec2 vUv;
        vec3 aces(vec3 color) {
          const mat3 inputMatrix = mat3(
            vec3(0.59719, 0.07600, 0.02840),
            vec3(0.35458, 0.90834, 0.13383),
            vec3(0.04823, 0.01566, 0.83777)
          );
          const mat3 outputMatrix = mat3(
            vec3(1.60475, -0.10208, -0.00327),
            vec3(-0.53108, 1.10813, -0.07276),
            vec3(-0.07367, -0.00605, 1.07602)
          );
          color = inputMatrix * (color * exposure / 0.6);
          vec3 a = color * (color + 0.0245786) - 0.000090537;
          vec3 b = color * (0.983729 * color + 0.4329510) + 0.238081;
          return clamp(outputMatrix * (a / b), 0.0, 1.0);
        }
        vec3 linearToSRGB(vec3 color) {
          vec3 low = color * 12.92;
          vec3 high = 1.055 * pow(max(color, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055;
          return mix(high, low, step(color, vec3(0.0031308)));
        }
        void main() {
          vec2 radial = vUv - vec2(0.5, 0.54);
          float edge = smoothstep(0.12, 0.64, length(radial));
          float amount = boost * edge * (0.018 + velocity * 0.013);
          vec3 sceneColor = texture2D(tScene, vUv).rgb;
          if (amount > 0.00001) {
            // Blur the outskirts of the view; the car and racing line remain clear.
            sceneColor *= 0.36;
            sceneColor += texture2D(tScene, vUv - radial * amount).rgb * 0.24;
            sceneColor += texture2D(tScene, vUv - radial * amount * 2.0).rgb * 0.18;
            sceneColor += texture2D(tScene, vUv - radial * amount * 3.0).rgb * 0.13;
            sceneColor += texture2D(tScene, vUv - radial * amount * 4.0).rgb * 0.09;
          }
          vec3 glow = texture2D(tBloom, vUv).rgb;
          vec3 color = sceneColor + glow * (0.38 + boost * 0.13);
          float vignette = 1.0 - smoothstep(0.2, 0.73, length(vUv - 0.5)) * 0.11;
          color *= vignette;
          // A restrained cyan pulse only at the edges during nitro.
          color += vec3(0.004, 0.025, 0.04) * boost * edge * (0.95 + 0.05 * sin(clock * 8.0));
          // These are the ONLY display transforms. There are deliberately no
          // Three.js tonemapping_fragment or colorspace_fragment includes.
          gl_FragColor = vec4(linearToSRGB(aces(color)), 1.0);
        }
      `);
      this.passScene = new THREE.Scene();
      this.passCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      this.geometry = new THREE.PlaneGeometry(2, 2);
      this.resources.push(this.geometry);
      this.quad = new THREE.Mesh(this.geometry, this.extract);
      this.quad.frustumCulled = false;
      this.passScene.add(this.quad);
      const size = renderer.getSize(new THREE.Vector2());
      this.resize(size.x, size.y, renderer.getPixelRatio());
      this.enabled = true;
    } catch (error) {
      this._release();
      // Direct rendering still uses the host renderer's original tone mapping.
      console.warn('Cinematic effects unavailable; using direct rendering.', error.message);
    }
  }

  resize(width, height, pixelRatio = 1) {
    if (this.disposed || !this.sceneTarget) return;
    const ratio = Math.max(0.5, Math.min(1.5, Number(pixelRatio) || 1));
    const w = Math.max(1, Math.floor(width * ratio));
    const h = Math.max(1, Math.floor(height * ratio));
    const bw = Math.max(1, Math.floor(w / 4));
    const bh = Math.max(1, Math.floor(h / 4));
    this.sceneTarget.setSize(w, h);
    this.bloomA.setSize(bw, bh);
    this.bloomB.setSize(bw, bh);
    this.extract.uniforms.texel.value.set(1 / w, 1 / h);
    this.bloomWidth = bw;
    this.bloomHeight = bh;
  }

  render(scene, camera, { boost = 0, speed = 0, time = 0 } = {}) {
    const renderer = this.renderer;
    if (!this.enabled || this.disposed) {
      renderer.render(scene, camera);
      return;
    }
    const target = renderer.getRenderTarget();
    const toneMapping = renderer.toneMapping;
    const autoClear = renderer.autoClear;
    let failed = false;
    try {
      renderer.toneMapping = this.THREE.NoToneMapping;
      renderer.autoClear = true;
      // Linear HDR scene. Render-target colorSpace prevents sRGB conversion.
      renderer.setRenderTarget(this.sceneTarget);
      renderer.render(scene, camera);
      const pass = (material, destination) => {
        this.quad.material = material;
        renderer.setRenderTarget(destination);
        renderer.render(this.passScene, this.passCamera);
      };
      pass(this.extract, this.bloomA);
      this.blur.uniforms.tInput.value = this.bloomA.texture;
      this.blur.uniforms.direction.value.set(1.75 / this.bloomWidth, 0);
      pass(this.blur, this.bloomB);
      this.blur.uniforms.tInput.value = this.bloomB.texture;
      this.blur.uniforms.direction.value.set(0, 1.75 / this.bloomHeight);
      pass(this.blur, this.bloomA);
      const uniforms = this.composite.uniforms;
      uniforms.boost.value = Math.max(0, Math.min(1, Number(boost) || 0));
      uniforms.velocity.value = Math.max(0, Math.min(1, Number(speed) / 320 || 0));
      uniforms.clock.value = Number(time) || 0;
      uniforms.exposure.value = renderer.toneMappingExposure;
      pass(this.composite, target);
    } catch (error) {
      this.enabled = false;
      failed = true;
      console.warn('Cinematic effects disabled; using direct rendering.', error.message);
    } finally {
      renderer.toneMapping = toneMapping;
      renderer.autoClear = autoClear;
      renderer.setRenderTarget(target);
    }
    if (failed) renderer.render(scene, camera);
  }

  _release() {
    for (const resource of this.resources) resource.dispose();
    this.resources.length = 0;
    this.sceneTarget = null;
    this.bloomA = null;
    this.bloomB = null;
  }

  dispose() {
    if (this.disposed) return;
    this.enabled = false;
    this.disposed = true;
    this._release();
  }
}
