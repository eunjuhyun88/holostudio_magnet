import * as THREE from "three";

export function createLine(
  start: THREE.Vector3,
  end: THREE.Vector3,
  color: string,
  opacity: number,
) {
  const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
  return new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
    }),
  );
}

export function createStarField(
  count: number,
  radiusMin: number,
  radiusSpread: number,
  size: number,
  color: number,
  opacity: number,
) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  for (let index = 0; index < count; index += 1) {
    const stride = index * 3;
    const radius = radiusMin + Math.random() * radiusSpread;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    positions[stride] = radius * Math.sin(phi) * Math.cos(theta);
    positions[stride + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[stride + 2] = radius * Math.cos(phi);

    // Non-uniform star sizes for organic feel
    const r = Math.random();
    sizes[index] = size * (r < 0.7 ? 0.5 + r : r < 0.92 ? 1.0 + Math.random() * 0.6 : 1.6 + Math.random() * 1.0);
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

  const colorObj = new THREE.Color(color);
  const pixelRatio = typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 2) : 1;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: colorObj },
      uOpacity: { value: opacity },
      uPixelRatio: { value: pixelRatio },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute float aSize;
      uniform float uPixelRatio;
      uniform float uTime;
      varying float vTwinkle;
      void main() {
        // Per-star twinkle using position-based hash as phase
        float phase = dot(position.xyz, vec3(12.9898, 78.233, 37.719));
        float speed = 0.3 + fract(phase * 0.1) * 0.7;
        vTwinkle = 0.55 + 0.45 * sin(uTime * speed + fract(phase) * 6.2831);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPixelRatio * (280.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vTwinkle;
      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        float alpha = smoothstep(0.5, 0.05, dist) * uOpacity * vTwinkle;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  return new THREE.Points(geometry, material);
}

export function createOrbitalParticleShell(
  count: number,
  radius: number,
  jitter: number,
  baseSize: number,
  color: number,
  opacity: number,
) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  for (let index = 0; index < count; index += 1) {
    const stride = index * 3;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const shellRadius = radius + (Math.random() - 0.5) * jitter;

    positions[stride] = shellRadius * Math.sin(phi) * Math.cos(theta);
    positions[stride + 1] = shellRadius * Math.cos(phi);
    positions[stride + 2] = shellRadius * Math.sin(phi) * Math.sin(theta);

    // Non-uniform size distribution: mostly small, few large (organic feel)
    const r = Math.random();
    sizes[index] = baseSize * (
      r < 0.65 ? 0.4 + Math.random() * 0.6 :
      r < 0.90 ? 1.0 + Math.random() * 0.8 :
      1.8 + Math.random() * 1.4
    );
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

  const colorObj = new THREE.Color(color);
  const pixelRatio = typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 2) : 1;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: colorObj },
      uOpacity: { value: opacity },
      uPixelRatio: { value: pixelRatio },
    },
    vertexShader: /* glsl */ `
      attribute float aSize;
      uniform float uPixelRatio;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPixelRatio * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        float alpha = smoothstep(0.5, 0.0, dist) * uOpacity;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  return new THREE.Points(geometry, material);
}

export function createLabelSprite(text: string, tone: string, emphasized: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const context = canvas.getContext("2d");
  if (!context) {
    const fallbackMaterial = new THREE.SpriteMaterial({
      color: tone,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const fallback = new THREE.Sprite(fallbackMaterial);
    fallback.scale.set(0.38, 0.12, 1);
    return fallback;
  }

  const glow = emphasized ? 28 : 16;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(4, 11, 22, 0.54)";
  roundRect(context, 8, 20, canvas.width - 16, canvas.height - 40, 28);
  context.fill();

  context.shadowColor = tone;
  context.shadowBlur = glow;
  context.fillStyle = tone;
  context.font = `700 ${emphasized ? 42 : 34}px "Avenir Next", sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text.toUpperCase(), canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: emphasized ? 1 : 0.92,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(emphasized ? 0.52 : 0.42, emphasized ? 0.16 : 0.13, 1);
  return sprite;
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

export function clearObjectGroup(group: THREE.Group) {
  while (group.children.length > 0) {
    const child = group.children[0];
    group.remove(child);
    disposeObject(child);
  }
}

export function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }

    const material = mesh.material;
    if (Array.isArray(material)) {
      for (const item of material) {
        if ("map" in item && item.map) {
          item.map.dispose();
        }
        item.dispose();
      }
    } else if (material) {
      if ("map" in material && material.map) {
        material.map.dispose();
      }
      material.dispose();
    }
  });
}
