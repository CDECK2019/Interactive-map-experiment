'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  OrbitControls,
  Stars,
  PerspectiveCamera,
  Stats
} from '@react-three/drei';
import * as THREE from 'three';
import { IRepData } from '@/types/index';
import ThreeMesh from '@/components/three-mesh';
import { CloudMesh } from '@/components/three-cloud-mesh';
import { ConfirmationHistoryTable } from '@/components/confirmation-history-table';
import { DonationImagePopover } from '@/components/donation-image-popover';
import { useConfirmations } from '@/providers/confirmation-provider';
import { DonationAnimation } from '@/components/donation-animation';
import { NANO_LIVE_ENV } from '@/constants/nano-live-env';
import { parseNanoAmount } from '@/lib/parse-nano-amount';
import { Vector3 } from 'three';
import { scaleRocketCount } from '@/lib/scale-rocket-count';
import { Button } from '@/components/ui/button';
import { Rocket, Eye, Globe } from 'lucide-react';
import RocketAnimationManager from '@/components/rocket-animation-manager';

function getRandomPositionOnGlobe(radius: number = 1.2): Vector3 {
  const phi = Math.random() * Math.PI * 2;
  const theta = Math.acos(Math.random() * 2 - 1);

  const x = radius * Math.sin(theta) * Math.cos(phi);
  const y = radius * Math.sin(theta) * Math.sin(phi);
  const z = radius * Math.cos(theta);

  return new Vector3(x, y, z);
}

interface ThreeSceneClientProps {
  repsGeoInfo: IRepData[];
  serverDateTime: Date | null;
}

const ThreeSceneClient: React.FC<ThreeSceneClientProps> = ({
  repsGeoInfo,
  serverDateTime
}) => {
  const EarthRadiusInKm = 6357; // Earth's equatorial radius in kilometers
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const [simulationTime, setSimulationTime] = useState<Date>(
    serverDateTime || new Date()
  );
  const [hoveredNode, setHoveredNode] = useState<IRepData | null>(null);
  const { confirmationHistory: confirmations } = useConfirmations();
  const [launchQueue, setLaunchQueue] = useState<Vector3[]>([]);
  const [isRocketView, setIsRocketView] = useState(false);
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const [activeRocketIndex, setActiveRocketIndex] = useState<number | null>(
    null
  ); // Track the active rocket index
  const [rocketCount, setRocketCount] = useState(0);
  const rocketManagerRef = useRef<{
    addRocket: (position: Vector3) => void;
  } | null>(null);
  const [distanceFromEarth, setDistanceFromEarth] = useState<number>(0); // State to hold distance

  const toggleRocketView = useCallback(() => {
    setIsRocketView((prev) => !prev);
    if (!isRocketView && rocketCount > 0) {
      setActiveRocketIndex(0);
    } else {
      setActiveRocketIndex(null);
    }
  }, [rocketCount, isRocketView]);

  const moveToNextRocket = useCallback(() => {
    if (isRocketView && rocketCount > 0) {
      setActiveRocketIndex((prevIndex) => {
        if (prevIndex === null) return 0;
        return (prevIndex + 1) % rocketCount;
      });
    }
  }, [isRocketView, rocketCount]);

  useEffect(() => {
    if (serverDateTime) {
      setSimulationTime(serverDateTime);
    }
  }, [serverDateTime]);

  useEffect(() => {
    const latestConfirmation = confirmations[0];
    if (latestConfirmation) {
      const isDonation =
        latestConfirmation.message.block.link_as_account ===
        NANO_LIVE_ENV.donationAccount;
      const amount = parseNanoAmount(latestConfirmation.message.amount);
      const isSend = latestConfirmation.message.block.subtype === 'send';
      if (isDonation) {
        // Trigger existing donation animation
        if ((window as any).triggerDonationAnimation) {
          (window as any).triggerDonationAnimation(amount);
        }
      }

      if (isSend) {
        const newRocketCount = Math.max(
          scaleRocketCount(amount),
          rocketCount === 0 ? 1 : 0
        );

        for (let i = 0; i < newRocketCount; i++) {
          const randomPosition = getRandomPositionOnGlobe();
          rocketManagerRef.current?.addRocket(randomPosition);
        }
      }
    }
  }, [confirmations]);

  const handleRocketComplete = (id: string) => {
    setRocketCount((prevCount) => prevCount - 1);
  };

  const handleRocketCountChange = useCallback((count: number) => {
    setRocketCount(count);
    if (count === 0) {
      setIsRocketView(false);
      setActiveRocketIndex(null);
    }
  }, []);

  useEffect(() => {
    if (launchQueue.length > 0 && activeRocketIndex === null) {
      setActiveRocketIndex(0); // Set the first rocket as active only if it's null
    }
  }, [launchQueue, activeRocketIndex]); // Add activeRocketIndex to dependencies

  // New function to reset to Earth view
  const resetToEarthView = () => {
    setIsRocketView(false);

    setTimeout(() => {
      if (cameraRef.current) {
        cameraRef.current.position.set(0, 0, 5);
        cameraRef.current.lookAt(new THREE.Vector3(0, 0, 0)); // Look at the center of the Earth
      }
    }, 100);
  };

  if (!serverDateTime) {
    return null;
  }

  return (
    <div className="relative w-screen h-screen">
      <div className="absolute top-1 md:top-4 left-4 md:left-10 z-10 flex-col select-none">
        <span className="text-[30px] md:text-[40px] font-thin font-sans text-[#209ce9]">
          ӾNO
        </span>
        <span className="text-[30px] md:text-[40px] text-gray-200">Hub</span>
      </div>

      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <div className="flex flex-row gap-2">
          {/* New button to reset to Earth view */}
          {distanceFromEarth > 10 && (
            <Button
              onClick={resetToEarthView}
              variant="outline"
              size="sm"
              className="flex select-none items-center gap-2 bg-transparent hover:bg-transparent hover:text-[#209ce9]"
            >
              Back to Earth
            </Button>
          )}
          <Button
            onClick={toggleRocketView}
            variant="outline"
            size="sm"
            className="flex select-none items-center gap-2 bg-transparent hover:bg-transparent hover:text-[#209ce9]"
          >
            {isRocketView ? (
              <Globe className="w-4 h-4 text-blue-400" />
            ) : (
              <Rocket className="w-4 h-4 text-red-600" />
            )}
            <span className="hidden md:inline text-center">
              {isRocketView ? 'Abort Mission' : 'Rocket View'}
            </span>
          </Button>
          {isRocketView && (
            <Button
              onClick={moveToNextRocket}
              variant="outline"
              size="sm"
              className="flex select-none items-center gap-2 bg-transparent hover:bg-transparent hover:text-[#209ce9]"
            >
              <Eye className="w-4 h-4" />
              <span className="hidden md:inline">Next Rocket</span>
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2 text-white">
          Active <Rocket className="w-4 h-4 text-red-600" /> {rocketCount}
        </div>
        <ConfirmationHistoryTable />
      </div>

      <Canvas
        camera={{
          fov: 45,
          position: [0, 2, 4]
        }}
        className="w-full h-full cursor-move pointer-events-auto"
      >
        <Stats />
        <PerspectiveCamera
          makeDefault
          ref={cameraRef}
          fov={45}
          position={[0, 2, 4]}
        />
        <OrbitControls
          enableRotate={!isRocketView}
          rotateSpeed={0.5}
          enableZoom={!isRocketView}
          zoomSpeed={0.6}
          enablePan={false}
        />
        <Stars
          radius={300}
          depth={60}
          count={20000}
          factor={7}
          saturation={0}
          fade={true}
        />
        <directionalLight ref={lightRef} color={0xffffff} intensity={2} />
        <ambientLight intensity={0.1} />
        <ThreeMesh
          lightRefs={[lightRef]}
          repsGeoInfo={repsGeoInfo}
          manualTime={simulationTime}
          onNodeHover={setHoveredNode}
        />
        <CloudMesh />
        <DonationAnimation />
        <RocketAnimationManager
          ref={rocketManagerRef}
          cameraRef={cameraRef}
          onRocketComplete={handleRocketComplete}
          onRocketCountChange={handleRocketCountChange}
          isRocketView={isRocketView}
          activeRocketIndex={activeRocketIndex}
          setActiveRocketIndex={setActiveRocketIndex}
          setDistanceFromEarth={setDistanceFromEarth}
        />
      </Canvas>

      {/* Donation Image Popover */}
      <div className="absolute bottom-6 right-6 z-10">
        <DonationImagePopover />
      </div>

      {/* Node Info */}
      <div className="absolute bottom-4 left-4 z-10">
        {hoveredNode && (
          <div className="bg-transparent text-white p-4 rounded-lg shadow-lg max-w-sm">
            <h3 className="text-lg font-bold mb-2">
              {hoveredNode.account_formatted ||
                hoveredNode.alias ||
                'Unknown Node'}
            </h3>
            <p>Weight: {hoveredNode.weight_formatted}</p>
          </div>
        )}
      </div>

      {isRocketView && (
        <div className="absolute bottom-4 left-4 right-4 md:right-auto z-10 bg-black md:bg-opacity-80 p-2 md:p-3 rounded-lg font-mono text-sm md:text-base text-center shadow-lg border-2 border-[#4A90E2] max-w-full md:max-w-[550px]">
          <div className="flex items-center justify-center mb-1 md:mb-2">
            <span
              className="text-lg md:text-xl mr-1 md:mr-2"
              role="img"
              aria-label="Earth"
            >
              🌍
            </span>
            <span className="text-[#4A90E2] text-xs md:text-sm">
              Earth: {(distanceFromEarth * EarthRadiusInKm).toFixed(0)} km (
              {distanceFromEarth.toFixed(1)})
            </span>
          </div>

          <div className="text-sm md:text-base my-1 md:my-2">
            {distanceFromEarth <= 2 && (
              <span className="text-yellow-300">
                &quot;Fast, feeless, green, and ready for liftoff! 🚀&quot;
              </span>
            )}

            {distanceFromEarth > 2 && distanceFromEarth <= 5 && (
              <span className="text-green-400">
                &quot;1 ӾNO = 1 ӾNO, even in space! 👩‍🚀 🛸&quot;
              </span>
            )}

            {distanceFromEarth > 5 && distanceFromEarth <= 10 && (
              <span className="text-blue-300">
                &quot;BROCCOLISH 🥦 All the way to the Mars!&quot;
              </span>
            )}

            {distanceFromEarth > 10 && distanceFromEarth <= 20 && (
              <span className="text-purple-400">
                &quot;Nano: Proof-of-work? We left that back on Earth 🌍&quot;
              </span>
            )}

            {distanceFromEarth > 20 && distanceFromEarth <= 30 && (
              <span className="text-pink-400">
                &quot;The further we go, the smaller our fees get. Oh wait...
                Nano is feeless 😎&quot;
              </span>
            )}

            {distanceFromEarth > 30 && distanceFromEarth <= 100 && (
              <span className="text-orange-400">
                &quot;🚨 Nano speed initiated 🚨. Nano&apos;s block lattice is
                unstoppable! 🌀&quot;
              </span>
            )}

            {distanceFromEarth > 200 && distanceFromEarth <= 350 && (
              <span className="text-pink-400">
                &quot;Not even cosmic inflation can inflate Nano&apos;s supply!
                💥&quot;
              </span>
            )}

            {distanceFromEarth > 350 && distanceFromEarth <= 500 && (
              <span className="text-[#4A90E2] font-bold">
                &quot;Zero fees across the universe, Nano is boundless. 💫
                🌌&quot;
              </span>
            )}

            {distanceFromEarth > 500 && distanceFromEarth <= 600 && (
              <span className="text-green-400 font-bold animate-pulse">
                &quot;Nano IS Nano 🗿&quot;
              </span>
            )}

            {distanceFromEarth > 600 && (
              <span className="text-red-500 font-bold animate-pulse">
                &quot;USER-35077: What if ... falls to 2k 💀&quot;
              </span>
            )}
          </div>

          <div className="mt-1 md:mt-2 text-[10px] md:text-xs text-gray-400">
            Fun fact: This Falcon Heavy runs on pure Nano. No fees, no fuel! ⚡
          </div>
        </div>
      )}
    </div>
  );
};

export default ThreeSceneClient;
