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
      mainGroup.position.set(0, 0, 0);
      scene.add(mainGroup);

      // Lighting - Bekatos Brand Ambient & Point Lights
      const ambientLight = new THREE.AmbientLight(0x0a0b4e, 2.8);
      scene.add(ambientLight);

      const cyanPointLight = new THREE.PointLight(0x38bdf8, 4.5, 60);
      cyanPointLight.position.set(8, 8, 10);
      scene.add(cyanPointLight);

      const bekatosCoralLight = new THREE.PointLight(0xeb5545, 5.5, 60);
      bekatosCoralLight.position.set(-8, -6, 8);
      scene.add(bekatosCoralLight);

      const bekatosBlueLight = new THREE.PointLight(0x1c2b8e, 6.0, 50);
      bekatosBlueLight.position.set(0, -9, 6);
      scene.add(bekatosBlueLight);

      const purpleLight = new THREE.PointLight(0x818cf8, 3.0, 50);
      purpleLight.position.set(0, 9, -5);
      scene.add(purpleLight);

      // Central Icosahedron Cage (Outer Wireframe)
      const outerGeo = new THREE.IcosahedronGeometry(2.8, 1);
      const outerMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        wireframe: true,
        transparent: true,
        opacity: 0.4,
        roughness: 0.2,
        metalness: 0.8,
      });
      const outerMesh = new THREE.Mesh(outerGeo, outerMat);
      mainGroup.add(outerMesh);

      // Inner Faceted Core (Bekatos Deep Navy & Blue Emissive)
      const innerGeo = new THREE.IcosahedronGeometry(1.8, 0);
      const innerMat = new THREE.MeshPhysicalMaterial({
        color: 0x0a0b4e,
        emissive: 0x1c2b8e,
        emissiveIntensity: 0.6,
        roughness: 0.15,
        metalness: 0.85,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        transparent: true,
        opacity: 0.88,
      });
      const innerMesh = new THREE.Mesh(innerGeo, innerMat);
      mainGroup.add(innerMesh);

      // Inner Pulsing Core Glow
      const glowGeo = new THREE.SphereGeometry(0.95, 24, 24);
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0x67e8f9,
        wireframe: true,
        transparent: true,
        opacity: 0.5,
      });
      const glowMesh = new THREE.Mesh(glowGeo, glowMat);
      mainGroup.add(glowMesh);

      // Orbiting Torus Rings (Bekatos Royal Blue, Coral, and Sky)
      const ring1Geo = new THREE.TorusGeometry(4.2, 0.035, 16, 120);
      const ring1Mat = new THREE.MeshBasicMaterial({
        color: 0x1c2b8e,
        transparent: true,
        opacity: 0.5,
      });
      const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
      ring1.rotation.x = Math.PI / 3;
      ring1.rotation.y = Math.PI / 6;
      mainGroup.add(ring1);

      const ring2Geo = new THREE.TorusGeometry(5.5, 0.03, 16, 140);
      const ring2Mat = new THREE.MeshBasicMaterial({
        color: 0xeb5545,
        transparent: true,
        opacity: 0.45,
      });
      const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
      ring2.rotation.x = -Math.PI / 4;
      ring2.rotation.y = Math.PI / 4;
      mainGroup.add(ring2);

      const ring3Geo = new THREE.TorusGeometry(6.6, 0.024, 16, 140);
      const ring3Mat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.35,
      });
      const ring3 = new THREE.Mesh(ring3Geo, ring3Mat);
      ring3.rotation.x = Math.PI / 2.2;
      mainGroup.add(ring3);

      const ring4Geo = new THREE.TorusGeometry(7.6, 0.02, 16, 160);
      const ring4Mat = new THREE.MeshBasicMaterial({
        color: 0x818cf8,
        transparent: true,
        opacity: 0.28,
      });
      const ring4 = new THREE.Mesh(ring4Geo, ring4Mat);
      ring4.rotation.x = -Math.PI / 3.5;
      ring4.rotation.z = Math.PI / 5;
      mainGroup.add(ring4);

      // Orbiting Satellite Nodes (featuring Bekatos Coral and Blue)
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
        { color: 0xeb5545, radius: 4.4, speed: 0.85, size: 0.46, inclination: 0.4 },
        { color: 0x1c2b8e, radius: 5.6, speed: -0.6, size: 0.42, inclination: -0.6 },
        { color: 0x38bdf8, radius: 6.8, speed: 0.42, size: 0.44, inclination: 0.8 },
        { color: 0x10b981, radius: 4.8, speed: -0.9, size: 0.35, inclination: -0.3 },
        { color: 0xa855f7, radius: 7.6, speed: 0.32, size: 0.4, inclination: 0.5 },
      ];

      nodeConfigs.forEach((cfg) => {
        const satGeo = new THREE.BoxGeometry(cfg.size, cfg.size, cfg.size);
        const satMat = new THREE.MeshStandardMaterial({
          color: cfg.color,
          emissive: cfg.color,
          emissiveIntensity: 0.65,
          roughness: 0.2,
          metalness: 0.8,
        });
        const satMesh = new THREE.Mesh(satGeo, satMat);
        mainGroup.add(satMesh);

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
      const particleCount = 300;
      const particleGeo = new THREE.BufferGeometry();
      const particlePositions = new Float32Array(particleCount * 3);

      for (let i = 0; i < particleCount; i++) {
        particlePositions[i * 3] = (Math.random() - 0.5) * 44;
        particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 40;
        particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 24 - 4;
      }

      particleGeo.setAttribute(
        "position",
        new THREE.BufferAttribute(particlePositions, 3)
      );

      const particleMat = new THREE.PointsMaterial({
        color: 0x7dd3fc,
        size: 0.13,
        transparent: true,
        opacity: 0.6,
      });

      const particles = new THREE.Points(particleGeo, particleMat);
      scene.add(particles);

      // Mouse Parallax across entire window
      let mouseX = 0;
      let mouseY = 0;
      let targetX = 0;
      let targetY = 0;

      const handleMouseMove = (e: MouseEvent) => {
        mouseX = (e.clientX / (window.innerWidth || 1)) * 2 - 1;
        mouseY = -((e.clientY / (window.innerHeight || 1)) * 2 - 1);
      };

      window.addEventListener("mousemove", handleMouseMove, { passive: true });

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
        window.removeEventListener("mousemove", handleMouseMove);
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
        ring4Geo.dispose();
        ring4Mat.dispose();
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
