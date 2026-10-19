import React, { useEffect, useRef } from "react";
import * as THREE from "three";

function isWebGLAvailable(): boolean {
  try {
    if (typeof window === "undefined" || !window.WebGLRenderingContext) {
      return false;
    }
    const canvas = document.createElement("canvas");
    return !!(
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl") ||
      canvas.getContext("webgl2")
    );
  } catch {
    return false;
  }
}

export default function LoginThreeBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isWebGLAvailable()) {
      return;
    }

    let animationFrameId: number;
    let renderer: THREE.WebGLRenderer | null = null;

    try {
      const scene = new THREE.Scene();

      // Camera setup
      const width = container.clientWidth || 600;
      const height = container.clientHeight || 800;
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
      camera.position.set(0, 0, 16);

      // Renderer setup
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;
      container.appendChild(renderer.domElement);

      // Main 3D Group
      const mainGroup = new THREE.Group();
      // Shift slightly down and right for visual balance with the text
      mainGroup.position.set(2.2, -2.8, 0);
      scene.add(mainGroup);

      // Lighting
      const ambientLight = new THREE.AmbientLight(0x0f2744, 2.5);
      scene.add(ambientLight);

      const cyanPointLight = new THREE.PointLight(0x00d2ff, 4.0, 50);
      cyanPointLight.position.set(6, 6, 8);
      scene.add(cyanPointLight);

      const coralPointLight = new THREE.PointLight(0xff5722, 3.5, 50);
      coralPointLight.position.set(-6, -6, 6);
      scene.add(coralPointLight);

      const purpleLight = new THREE.PointLight(0x818cf8, 2.5, 50);
      purpleLight.position.set(0, 8, -4);
      scene.add(purpleLight);

      // Central Icosahedron Cage (Outer Wireframe)
      const outerGeo = new THREE.IcosahedronGeometry(2.6, 1);
      const outerMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        wireframe: true,
        transparent: true,
        opacity: 0.38,
        roughness: 0.2,
        metalness: 0.8,
      });
      const outerMesh = new THREE.Mesh(outerGeo, outerMat);
      mainGroup.add(outerMesh);

      // Inner Faceted Core
      const innerGeo = new THREE.IcosahedronGeometry(1.7, 0);
      const innerMat = new THREE.MeshPhysicalMaterial({
        color: 0x0284c7,
        emissive: 0x0369a1,
        emissiveIntensity: 0.4,
        roughness: 0.15,
        metalness: 0.85,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        transparent: true,
        opacity: 0.82,
      });
      const innerMesh = new THREE.Mesh(innerGeo, innerMat);
      mainGroup.add(innerMesh);

      // Inner Pulsing Core Glow
      const glowGeo = new THREE.SphereGeometry(0.85, 24, 24);
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0x67e8f9,
        wireframe: true,
        transparent: true,
        opacity: 0.45,
      });
      const glowMesh = new THREE.Mesh(glowGeo, glowMat);
      mainGroup.add(glowMesh);

      // Orbiting Torus Rings
      const ring1Geo = new THREE.TorusGeometry(3.8, 0.035, 16, 100);
      const ring1Mat = new THREE.MeshBasicMaterial({
        color: 0x00d2ff,
        transparent: true,
        opacity: 0.4,
      });
      const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
      ring1.rotation.x = Math.PI / 3;
      ring1.rotation.y = Math.PI / 6;
      mainGroup.add(ring1);

      const ring2Geo = new THREE.TorusGeometry(4.7, 0.028, 16, 120);
      const ring2Mat = new THREE.MeshBasicMaterial({
        color: 0xf97316,
        transparent: true,
        opacity: 0.35,
      });
      const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
      ring2.rotation.x = -Math.PI / 4;
      ring2.rotation.y = Math.PI / 4;
      mainGroup.add(ring2);

      const ring3Geo = new THREE.TorusGeometry(5.4, 0.02, 16, 120);
      const ring3Mat = new THREE.MeshBasicMaterial({
        color: 0x818cf8,
        transparent: true,
        opacity: 0.25,
      });
      const ring3 = new THREE.Mesh(ring3Geo, ring3Mat);
      ring3.rotation.x = Math.PI / 2.2;
      mainGroup.add(ring3);

      // Orbiting Satellite Nodes (representing Customer, Dealer, Contractor)
      interface Satellite {
        mesh: THREE.Mesh;
        radius: number;
        speed: number;
        angle: number;
        inclination: number;
        line: THREE.Line;
      }

      const satellites: Satellite[] = [];
      const nodeConfigs = [
        { color: 0x00d2ff, radius: 3.8, speed: 0.9, size: 0.4, inclination: 0.5 },
        { color: 0xf97316, radius: 4.7, speed: -0.65, size: 0.45, inclination: -0.7 },
        { color: 0xa855f7, radius: 5.4, speed: 0.45, size: 0.38, inclination: 0.9 },
        { color: 0x10b981, radius: 3.2, speed: -1.1, size: 0.32, inclination: -0.3 },
      ];

      nodeConfigs.forEach((cfg) => {
        // Satellite Cube / Node
        const satGeo = new THREE.BoxGeometry(cfg.size, cfg.size, cfg.size);
        const satMat = new THREE.MeshStandardMaterial({
          color: cfg.color,
          emissive: cfg.color,
          emissiveIntensity: 0.6,
          roughness: 0.2,
          metalness: 0.8,
        });
        const satMesh = new THREE.Mesh(satGeo, satMat);
        mainGroup.add(satMesh);

        // Dynamic Connecting Laser Beam to center
        const lineGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, 0, 0),
        ]);
        const lineMat = new THREE.LineBasicMaterial({
          color: cfg.color,
          transparent: true,
          opacity: 0.35,
        });
        const line = new THREE.Line(lineGeo, lineMat);
        mainGroup.add(line);

        satellites.push({
          mesh: satMesh,
          radius: cfg.radius,
          speed: cfg.speed,
          angle: Math.random() * Math.PI * 2,
          inclination: cfg.inclination,
          line,
        });
      });

      // Background Starfield / Particle Cloud
      const particleCount = 220;
      const particleGeo = new THREE.BufferGeometry();
      const particlePositions = new Float32Array(particleCount * 3);
      const particleScales = new Float32Array(particleCount);

      for (let i = 0; i < particleCount; i++) {
        particlePositions[i * 3] = (Math.random() - 0.5) * 32;
        particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 32;
        particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 20 - 4;
        particleScales[i] = Math.random() * 2 + 0.5;
      }

      particleGeo.setAttribute(
        "position",
        new THREE.BufferAttribute(particlePositions, 3)
      );

      const particleMat = new THREE.PointsMaterial({
        color: 0x7dd3fc,
        size: 0.12,
        transparent: true,
        opacity: 0.55,
      });

      const particles = new THREE.Points(particleGeo, particleMat);
      scene.add(particles);

      // Mouse Parallax
      let mouseX = 0;
      let mouseY = 0;
      let targetX = 0;
      let targetY = 0;

      const handleMouseMove = (e: MouseEvent) => {
        const rect = container.getBoundingClientRect();
        mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouseY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      };

      container.addEventListener("mousemove", handleMouseMove);

      // Resize Observer
      const handleResize = () => {
        if (!container || !renderer) return;
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };

      const resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      resizeObserver.observe(container);

      // Animation Loop
      const clock = new THREE.Clock();

      const animate = () => {
        animationFrameId = requestAnimationFrame(animate);

        const delta = clock.getDelta();
        const time = clock.getElapsedTime();

        // Mouse lerp damping
        targetX += (mouseX - targetX) * 0.04;
        targetY += (mouseY - targetY) * 0.04;

        // Rotate main group with mouse reaction
        mainGroup.rotation.y = time * 0.22 + targetX * 0.6;
        mainGroup.rotation.x = Math.sin(time * 0.18) * 0.15 - targetY * 0.4;
        mainGroup.rotation.z = Math.cos(time * 0.14) * 0.1;

        // Inner core counter-rotation
        innerMesh.rotation.y = -time * 0.35;
        innerMesh.rotation.x = time * 0.25;

        // Pulse inner glow
        const scale = 1 + Math.sin(time * 3.0) * 0.08;
        glowMesh.scale.set(scale, scale, scale);

        // Rotate rings
        ring1.rotation.z = time * 0.2;
        ring2.rotation.z = -time * 0.18;
        ring3.rotation.z = time * 0.12;

        // Orbit satellites and update connecting lines
        satellites.forEach((sat) => {
          sat.angle += sat.speed * delta * 0.8;
          const x = Math.cos(sat.angle) * sat.radius;
          const z = Math.sin(sat.angle) * sat.radius;
          const y = Math.sin(sat.angle * 1.5 + sat.inclination) * (sat.radius * 0.35);

          sat.mesh.position.set(x, y, z);
          sat.mesh.rotation.x += delta * 2;
          sat.mesh.rotation.y += delta * 1.5;

          // Update beam points
          const positions = sat.line.geometry.attributes.position.array as Float32Array;
          positions[0] = 0;
          positions[1] = 0;
          positions[2] = 0;
          positions[3] = x;
          positions[4] = y;
          positions[5] = z;
          sat.line.geometry.attributes.position.needsUpdate = true;
        });

        // Drift particles
        particles.rotation.y = time * 0.03;
        particles.rotation.x = Math.sin(time * 0.05) * 0.05;

        if (renderer) {
          renderer.render(scene, camera);
        }
      };

      animate();

      return () => {
        cancelAnimationFrame(animationFrameId);
        container.removeEventListener("mousemove", handleMouseMove);
        resizeObserver.disconnect();

        if (renderer && renderer.domElement && container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
          renderer.dispose();
        }

        // Dispose geometries & materials
        outerGeo.dispose();
        outerMat.dispose();
        innerGeo.dispose();
        innerMat.dispose();
        glowGeo.dispose();
        glowMat.dispose();
        ring1Geo.dispose();
        ring1Mat.dispose();
        ring2Geo.dispose();
        ring2Mat.dispose();
        ring3Geo.dispose();
        ring3Mat.dispose();
        particleGeo.dispose();
        particleMat.dispose();

        satellites.forEach((sat) => {
          sat.mesh.geometry.dispose();
          (sat.mesh.material as THREE.Material).dispose();
          sat.line.geometry.dispose();
          (sat.line.material as THREE.Material).dispose();
        });
      };
    } catch {
      // Graceful fallback for non-WebGL environments
      return;
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className="login-three-canvas-container"
      aria-hidden="true"
    />
  );
}
