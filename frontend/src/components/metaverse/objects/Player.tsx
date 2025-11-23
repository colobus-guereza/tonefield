"use client";

import { useThree, useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/**
 * 우주선 비행 물리 모델 (SpaceshipPhysics)
 * 
 * 관성과 가속도를 활용한 비행 물리학을 구현합니다.
 * 드리프트 효과로 우주 공간 특유의 느낌을 제공합니다.
 */
class SpaceshipPhysics {
    // 설정값 (조절하여 비행 느낌 변경 가능)
    acceleration: number = 50.0;   // 가속력 (엑셀 밟을 때 힘)
    maxSpeed: number = 100.0;       // 최고 속도 제한
    turnSpeed: number = 2.0;       // 회전 속도
    friction: number = 2.0;        // 마찰력 (높을수록 금방 멈춤, 0이면 영원히 미끄러짐)
    
    // 물리 상태 변수
    velocity: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 }; // 현재 속도 벡터
    speed: number = 0; // 현재 속력 스칼라

    /**
     * 프레임마다 호출되어 우주선의 위치와 회전을 계산함
     * @param input - 입력 상태 (예: { forward: true, backward: false, left: true, right: false })
     * @param dt - 델타 타임 (지난 프레임과의 시간 차, 초 단위)
     * @param object3D - 움직일 3D 우주선 객체 (position, rotation 속성 필요)
     */
    update(
        input: { forward: boolean; backward: boolean; left: boolean; right: boolean },
        dt: number,
        object3D: { position: THREE.Vector3; rotation: THREE.Euler }
    ) {
        // 1. 회전 처리 (좌우 키로 방향만 회전)
        if (input.left) {
            object3D.rotation.y += this.turnSpeed * dt;
        }
        if (input.right) {
            object3D.rotation.y -= this.turnSpeed * dt;
        }

        // 2. 가속도 계산 (현재 바라보는 방향으로 힘을 가함)
        // 우주선이 바라보는 방향 벡터 계산 (Math.sin, Math.cos 사용)
        // Three.js에서 Z축은 앞쪽이 음수 방향이므로 -Math.cos 사용
        const directionX = Math.sin(object3D.rotation.y);
        const directionZ = -Math.cos(object3D.rotation.y);
        
        // 좌우 방향 벡터 계산 (전방 벡터를 90도 회전)
        const leftX = -Math.cos(object3D.rotation.y);
        const leftZ = -Math.sin(object3D.rotation.y);

        if (input.forward) {
            this.velocity.x += directionX * this.acceleration * dt;
            this.velocity.z += directionZ * this.acceleration * dt;
        }
        if (input.backward) {
            this.velocity.x -= directionX * (this.acceleration * 0.5) * dt; // 후진은 좀 더 느리게
            this.velocity.z -= directionZ * (this.acceleration * 0.5) * dt;
        }
        if (input.left) {
            // 좌측 이동 (회전과 별개로 좌우 이동도 가능)
            this.velocity.x += leftX * (this.acceleration * 0.7) * dt;
            this.velocity.z += leftZ * (this.acceleration * 0.7) * dt;
        }
        if (input.right) {
            // 우측 이동 (회전과 별개로 좌우 이동도 가능)
            this.velocity.x -= leftX * (this.acceleration * 0.7) * dt;
            this.velocity.z -= leftZ * (this.acceleration * 0.7) * dt;
        }

        // 3. 마찰력 적용 (관성 감쇠 - 서서히 멈춤)
        // 공식: 속도 = 속도 * (1 - 마찰계수 * 시간)
        const dampingFactor = 1.0 - (this.friction * dt);
        // dampingFactor가 0보다 작아지면 역주행하므로 0~1 사이 유지
        const safeDamping = Math.max(0.0, Math.min(1.0, dampingFactor));
        
        this.velocity.x *= safeDamping;
        this.velocity.z *= safeDamping;

        // 4. 속도 제한 (Max Speed Clamping)
        // 피타고라스 정리로 현재 속력 계산
        const currentSpeed = Math.sqrt(this.velocity.x**2 + this.velocity.z**2);
        if (currentSpeed > this.maxSpeed) {
            const ratio = this.maxSpeed / currentSpeed;
            this.velocity.x *= ratio;
            this.velocity.z *= ratio;
        }

        // 현재 속력 저장 (속도 콜백용)
        this.speed = currentSpeed;

        // 5. 최종 위치 적용 (위치 = 위치 + 속도 * 시간)
        object3D.position.x += this.velocity.x * dt;
        object3D.position.z += this.velocity.z * dt;
        
        // (선택사항) 비행 효과를 위한 틸트(기울기) 효과
        // 회전할 때 기체가 살짝 기울어지면 더 리얼함
        if (input.left) object3D.rotation.z = 0.2;
        else if (input.right) object3D.rotation.z = -0.2;
        else object3D.rotation.z = 0; // 원복
    }

    /**
     * 현재 속도를 km/h 단위로 반환 (표시용)
     */
    getSpeedInKmh(): number {
        // Three.js의 기본 단위를 km/h로 변환 (대략적인 변환)
        // 실제 변환 비율은 프로젝트 설정에 따라 조정 필요
        return this.speed * 3.6; // m/s를 km/h로 변환 (대략)
    }
}

interface PlayerProps {
    initialPosition?: [number, number, number];
    onPositionChange?: (position: [number, number, number]) => void;
    onRotationChange?: (rotation: [number, number, number]) => void;
    onVelocityChange?: (velocity: number) => void; // 속도 콜백 추가 (km/h)
    isSpaceshipMode?: boolean; // 우주선 모드 여부
}

export function Player({ initialPosition = [0, 0, -0.05], onPositionChange, onRotationChange, onVelocityChange, isSpaceshipMode = true }: PlayerProps) {
    const { camera, gl } = useThree();
    const [moveForward, setMoveForward] = useState(false);
    const [moveBackward, setMoveBackward] = useState(false);
    const [moveLeft, setMoveLeft] = useState(false);
    const [moveRight, setMoveRight] = useState(false);
    const [isBoosting, setIsBoosting] = useState(false); // 부스터 상태
    
    // 카메라 시점 타입 정의 (1인칭과 3인칭 뒤에서만)
    type CameraView = 'firstPerson' | 'thirdPersonBack';
    const [cameraView, setCameraView] = useState<CameraView>('firstPerson'); // 카메라 시점 상태
    
    // 마우스 회전을 위한 상태
    const euler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
    const PI_2 = Math.PI / 2;
    
    // 우주선 위치 추적 (카메라 시점 계산용)
    const spaceshipPositionRef = useRef<THREE.Vector3>(new THREE.Vector3(...initialPosition));
    const spaceshipRotationRef = useRef<THREE.Euler>(new THREE.Euler(0, 0, 0, 'YXZ'));

    // Physics state
    const velocity = useRef(new THREE.Vector3());
    const isJumping = useRef(false);
    
    // 우주선 물리 엔진 인스턴스
    const spaceshipPhysics = useRef<SpaceshipPhysics | null>(null);
    
    // 우주선 물리 엔진 초기화
    useEffect(() => {
        if (isSpaceshipMode && !spaceshipPhysics.current) {
            spaceshipPhysics.current = new SpaceshipPhysics();
            // Three.js 환경에 맞게 속도 조정 (더 느리게 설정)
            spaceshipPhysics.current.acceleration = 5.0;  // 가속력 조정
            spaceshipPhysics.current.maxSpeed = 10.0;    // 최고 속도 조정
            spaceshipPhysics.current.turnSpeed = 1.5;    // 회전 속도 조정
            spaceshipPhysics.current.friction = 1.5;     // 마찰력 조정
        }
    }, [isSpaceshipMode]);

    // Callback refs for useFrame
    const onPositionChangeRef = useRef(onPositionChange);
    const onRotationChangeRef = useRef(onRotationChange);
    const onVelocityChangeRef = useRef(onVelocityChange);

    // Update refs when props change
    useEffect(() => {
        onPositionChangeRef.current = onPositionChange;
        onRotationChangeRef.current = onRotationChange;
        onVelocityChangeRef.current = onVelocityChange;
    }, [onPositionChange, onRotationChange, onVelocityChange]);

    // Constants
    const SPEED = 0.15; // 일반 모드 속도
    const JUMP_FORCE = 0.2;
    const GRAVITY = 0.01;
    const GROUND_HEIGHT = 0; // 우주선 위치 기준
    const lastPositionRef = useRef<[number, number, number]>(initialPosition);
    const lastFramePositionRef = useRef<THREE.Vector3>(new THREE.Vector3(...initialPosition)); // 속도 계산용

    // 초기화 플래그 - 카메라 위치를 한 번만 초기화하기 위한 플래그
    const hasInitialized = useRef(false);

    // 플레이어 모델 위치 (바닥 기준)
    const playerModelPosition = useRef<THREE.Vector3>(new THREE.Vector3(...initialPosition));
    const playerModelRef = useRef<THREE.Group>(null);
    const EYE_HEIGHT = 1.6; // 눈 높이 (바닥 기준, 일반적인 사람의 눈 높이)

    // 카메라를 우주선 위치로 초기화 (최초 1회만)
    useEffect(() => {
        // 최초 1회만 초기화 실행
        if (!hasInitialized.current) {
            // 일반 모드에서는 카메라를 눈 높이로 설정 (플레이어 모델 위치 + EYE_HEIGHT)
            if (!isSpaceshipMode) {
                // 플레이어 모델은 바닥에 배치
                playerModelPosition.current.set(initialPosition[0], initialPosition[1], initialPosition[2]);
                const eyePosition: [number, number, number] = [
                    initialPosition[0],
                    initialPosition[1] + EYE_HEIGHT, // 플레이어 모델 위치 + 눈 높이
                    initialPosition[2]
                ];
                camera.position.set(...eyePosition);
                lastPositionRef.current = eyePosition;
            } else {
                // 우주선 모드에서는 기존대로
                camera.position.set(...initialPosition);
                lastPositionRef.current = [...initialPosition] as [number, number, number];
            }
            
            // 플레이어 모델 위치 초기화
            playerModelPosition.current.set(...initialPosition);
            
            // 우주선 위치 및 회전 초기화
            spaceshipPositionRef.current.set(...initialPosition);
            spaceshipRotationRef.current.set(0, 0, 0, 'YXZ');

            // 카메라가 앞쪽을 바라보도록 설정 (1인칭 시점)
            camera.rotation.set(0, 0, 0);
            euler.current.set(0, 0, 0, 'YXZ');

            // 중력 시스템 초기화
            velocity.current.set(0, 0, 0);
            isJumping.current = false;

            // 우주선 모드 물리 엔진 초기화
            if (isSpaceshipMode && spaceshipPhysics.current) {
                // 물리 엔진 속도 초기화
                spaceshipPhysics.current.velocity = { x: 0, y: 0, z: 0 };
                spaceshipPhysics.current.speed = 0;
                if (onVelocityChangeRef.current) {
                    onVelocityChangeRef.current(0);
                }
            }

            // 초기 위치 콜백 호출
            if (onPositionChangeRef.current) {
                const pos = isSpaceshipMode ? initialPosition : [
                    initialPosition[0],
                    initialPosition[1] + EYE_HEIGHT,
                    initialPosition[2]
                ] as [number, number, number];
                onPositionChangeRef.current(pos);
            }

            camera.updateProjectionMatrix();

            // 초기화 완료 표시
            hasInitialized.current = true;
        }
    }, [camera, initialPosition, isSpaceshipMode]);

    // 카메라 시점 변경 함수 (1인칭 ↔ 3인칭 뒤에서만)
    const changeCameraView = () => {
        if (!isSpaceshipMode) return;
        
        setCameraView((prev) => {
            let next: CameraView;
            switch (prev) {
                case 'firstPerson':
                    next = 'thirdPersonBack';
                    // 1인칭에서 3인칭으로 전환 시 현재 카메라 회전을 우주선 회전으로 복사
                    const tempEuler = new THREE.Euler(0, 0, 0, 'YXZ');
                    tempEuler.setFromQuaternion(camera.quaternion);
                    spaceshipRotationRef.current.y = tempEuler.y;
                    console.log('🚀 카메라 시점 변경: 3인칭 (뒤에서)');
                    break;
                case 'thirdPersonBack':
                    next = 'firstPerson';
                    // 3인칭에서 1인칭으로 전환 시 우주선 회전을 카메라 회전으로 복사
                    const euler2 = new THREE.Euler(0, spaceshipRotationRef.current.y, 0, 'YXZ');
                    camera.quaternion.setFromEuler(euler2);
                    euler.current.copy(euler2);
                    console.log('🚀 카메라 시점 변경: 1인칭 (조종석)');
                    break;
                default:
                    next = 'firstPerson';
            }
            return next;
        });
    };

    // 1. 키보드 이벤트 리스너 (WASD + Shift + Space + C 감지)
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            switch (event.code) {
                case 'ArrowUp':
                case 'KeyW': setMoveForward(true); break;
                case 'ArrowLeft':
                case 'KeyA': setMoveLeft(true); break;
                case 'ArrowDown':
                case 'KeyS': setMoveBackward(true); break;
                case 'ArrowRight':
                case 'KeyD': setMoveRight(true); break;
                case 'ShiftLeft':
                case 'ShiftRight':
                    if (isSpaceshipMode) {
                        setIsBoosting(true);
                    }
                    break;
                case 'KeyC':
                    if (isSpaceshipMode) {
                        event.preventDefault();
                        changeCameraView();
                    }
                    break;
                case 'Space':
                    // 일반 FPS 모드에서만 점프 가능
                    if (!isSpaceshipMode && !isJumping.current) {
                        const groundY = initialPosition[1]; // 바닥 높이
                        if (playerModelPosition.current.y <= groundY + 0.1) {
                            event.preventDefault();
                            velocity.current.y = JUMP_FORCE;
                            isJumping.current = true;
                        }
                    }
                    break;
            }
        };

        const handleKeyUp = (event: KeyboardEvent) => {
            switch (event.code) {
                case 'ArrowUp':
                case 'KeyW': setMoveForward(false); break;
                case 'ArrowLeft':
                case 'KeyA': setMoveLeft(false); break;
                case 'ArrowDown':
                case 'KeyS': setMoveBackward(false); break;
                case 'ArrowRight':
                case 'KeyD': setMoveRight(false); break;
                case 'ShiftLeft':
                case 'ShiftRight':
                    if (isSpaceshipMode) {
                        setIsBoosting(false);
                    }
                    break;
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('keyup', handleKeyUp);
        };
    }, [isSpaceshipMode]);
    
    // 카메라 시점 변경 시 초기 안내 문구 출력
    useEffect(() => {
        if (isSpaceshipMode && hasInitialized.current) {
            console.log('🚀 우주선 운전 모드 - 카메라 시점 변경 안내');
            console.log('   C 키: 카메라 시점 변경 (1인칭 ↔ 3인칭 뒤에서)');
        }
    }, [isSpaceshipMode]);

    // 2. Pointer Lock 및 마우스 회전 처리
    useEffect(() => {
        const canvas = gl.domElement;
        if (!canvas) return;

        // DOM에 요소가 존재하는지 확인하는 헬퍼 함수
        const isElementInDOM = (element: HTMLElement): boolean => {
            return document.contains(element) || element.isConnected;
        };

        let isLocked = false;

        const handleClick = () => {
            // DOM에 존재하는지 확인 후 lock 시도
            if (isElementInDOM(canvas)) {
                try {
                    canvas.requestPointerLock();
                } catch (error) {
                    // DOM에서 제거된 경우 무시
                    if (error instanceof Error && error.name !== 'WrongDocumentError') {
                        console.warn('Pointer lock failed:', error);
                    }
                }
            }
        };

        // 마우스 이동 처리
        const handleMouseMove = (event: MouseEvent) => {
            if (!isLocked) return;

            const movementX = event.movementX || 0;
            const movementY = event.movementY || 0;

            if (isSpaceshipMode) {
                // 우주선 모드: 시점에 따라 다르게 처리
                if (cameraView === 'firstPerson') {
                    // 1인칭 시점: 카메라 회전
                    euler.current.setFromQuaternion(camera.quaternion);
                    euler.current.y -= movementX * 0.002;
                    euler.current.x -= movementY * 0.002;
                    euler.current.x = Math.max(-PI_2, Math.min(PI_2, euler.current.x));
                    camera.quaternion.setFromEuler(euler.current);
                } else {
                    // 3인칭 시점: 우주선 회전 (Y축만, 수평 회전)
                    spaceshipRotationRef.current.y -= movementX * 0.002;
                }
            } else {
                // 일반 FPS 모드: 카메라 회전 (1인칭만 지원)
                euler.current.setFromQuaternion(camera.quaternion);
                euler.current.y -= movementX * 0.002;
                euler.current.x -= movementY * 0.002;
                euler.current.x = Math.max(-PI_2, Math.min(PI_2, euler.current.x));
                camera.quaternion.setFromEuler(euler.current);
            }
        };

        // Pointer lock 상태 변경 처리
        const handlePointerLockChange = () => {
            isLocked = document.pointerLockElement === canvas;
        };

        // Pointer lock 에러 처리 (SecurityError 등)
        const handlePointerLockError = (event: Event) => {
            console.warn('Pointer lock failed:', event);
            isLocked = false;
        };

        // ESC 키로 pointer lock 해제
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && document.pointerLockElement === canvas) {
                document.exitPointerLock();
            }
        };

        canvas.addEventListener('click', handleClick);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('pointerlockchange', handlePointerLockChange);
        document.addEventListener('pointerlockerror', handlePointerLockError);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            canvas.removeEventListener('click', handleClick);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('pointerlockchange', handlePointerLockChange);
            document.removeEventListener('pointerlockerror', handlePointerLockError);
            document.removeEventListener('keydown', handleKeyDown);
            
            // 컴포넌트 언마운트 시 pointer lock 해제
            if (document.pointerLockElement === canvas && isElementInDOM(canvas)) {
                try {
                    document.exitPointerLock();
                } catch (error) {
                    // 이미 해제된 경우 무시
                }
            }
        };
    }, [gl.domElement, camera, isSpaceshipMode, cameraView]);

    // 3. 매 프레임마다 카메라 위치 업데이트 (게임 루프)
    useFrame((state, delta) => {
        if (isSpaceshipMode && spaceshipPhysics.current) {
            // 우주선 모드: 물리 기반 비행 시스템
            
            // 물리 엔진을 위한 가상 우주선 객체 생성
            // (실제로는 spaceshipPositionRef와 spaceshipRotationRef를 사용)
            const spaceshipObject = {
                position: spaceshipPositionRef.current,
                rotation: spaceshipRotationRef.current
            };
            
            // 입력 상태를 물리 엔진 형식으로 변환
            const input = {
                forward: moveForward,
                backward: moveBackward,
                left: moveLeft,
                right: moveRight
            };
            
            // 1인칭 시점에서는 카메라 회전을 우주선 회전과 동기화
            if (cameraView === 'firstPerson') {
                const euler = new THREE.Euler(0, 0, 0, 'YXZ');
                euler.setFromQuaternion(camera.quaternion);
                spaceshipRotationRef.current.y = euler.y; // Y축 회전만 동기화
            }
            
            // 물리 엔진 업데이트 (관성과 드리프트 효과 포함)
            spaceshipPhysics.current.update(input, delta, spaceshipObject);
            
            // 1인칭 시점: 카메라 위치를 우주선 위치와 동기화
            if (cameraView === 'firstPerson') {
                camera.position.copy(spaceshipPositionRef.current);
            } else if (cameraView === 'thirdPersonBack') {
                // 3인칭 뒤에서: 우주선 뒤에서 멀리서 따라가는 시점
                const offset = new THREE.Vector3(0, 0.5, 1.5); // 뒤에서 멀리, 위로 약간
                const euler = new THREE.Euler(0, 0, 0, 'YXZ');
                euler.copy(spaceshipRotationRef.current);
                const quaternion = new THREE.Quaternion().setFromEuler(euler);
                offset.applyQuaternion(quaternion);
                
                const targetPosition = spaceshipPositionRef.current.clone().add(offset);
                camera.position.lerp(targetPosition, 0.1); // 부드러운 이동
                
                // 우주선을 바라보도록 회전
                const lookAtPosition = spaceshipPositionRef.current.clone();
                camera.lookAt(lookAtPosition);
            }
            
            // 속도 콜백 전달 (물리 엔진의 속도를 km/h로 변환)
            if (onVelocityChangeRef.current && spaceshipPhysics.current) {
                const speedKmh = spaceshipPhysics.current.getSpeedInKmh();
                onVelocityChangeRef.current(speedKmh);
            }
        } else {
            // 일반 모드: 기존 이동 시스템
            const direction = new THREE.Vector3();
            
            if (moveForward || moveBackward || moveLeft || moveRight) {
                // 카메라의 전체 회전을 사용하여 이동 방향 계산 (위/아래 시야 포함)
                const quaternion = camera.quaternion.clone();
                
                if (moveForward) {
                    direction.set(0, 0, -1).applyQuaternion(quaternion);
                }
                if (moveBackward) {
                    direction.set(0, 0, 1).applyQuaternion(quaternion);
                }
                if (moveLeft) {
                    direction.set(-1, 0, 0).applyQuaternion(quaternion);
                }
                if (moveRight) {
                    direction.set(1, 0, 0).applyQuaternion(quaternion);
                }
                
                // 여러 방향 입력 시 정규화
                if ((moveForward || moveBackward) && (moveLeft || moveRight)) {
                    direction.normalize();
                }
                
                // 플레이어 모델 위치 업데이트
                playerModelPosition.current.add(direction.clone().multiplyScalar(SPEED));
                
                // 카메라는 플레이어 모델 위치 + 눈 높이로 설정 (점프 시 함께 올라감)
                camera.position.x = playerModelPosition.current.x;
                camera.position.z = playerModelPosition.current.z;
                camera.position.y = playerModelPosition.current.y + EYE_HEIGHT;
            }
        }

        // 2. Vertical Movement (Jump & Gravity) - 우주선 모드에서는 무시
        if (!isSpaceshipMode) {
            playerModelPosition.current.y += velocity.current.y;

            // Apply Gravity if in air (바닥 기준)
            const groundY = initialPosition[1]; // 바닥 높이
            if (playerModelPosition.current.y > groundY) {
                velocity.current.y -= GRAVITY;
            } else {
                // Hit ground
                playerModelPosition.current.y = Math.max(groundY, playerModelPosition.current.y);
                if (playerModelPosition.current.y <= groundY) {
                    velocity.current.y = 0;
                    isJumping.current = false;
                }
            }
            
            // 카메라는 플레이어 모델 위치 + 눈 높이로 설정 (점프 시 함께 올라감)
            camera.position.x = playerModelPosition.current.x;
            camera.position.z = playerModelPosition.current.z;
            camera.position.y = playerModelPosition.current.y + EYE_HEIGHT;
        }

        // 3. 카메라 위치가 변경되면 우주선 위치도 업데이트
        // 우주선 모드에서는 spaceshipPositionRef를 사용, 일반 모드에서는 playerModelPosition 사용
        const currentPosition: [number, number, number] = isSpaceshipMode && cameraView !== 'firstPerson'
            ? [
                spaceshipPositionRef.current.x,
                spaceshipPositionRef.current.y,
                spaceshipPositionRef.current.z
            ]
            : [
                playerModelPosition.current.x,
                playerModelPosition.current.y + EYE_HEIGHT, // 플레이어 모델 위치 + 눈 높이
                playerModelPosition.current.z
            ];
        
        // 위치가 변경되었는지 확인 (성능 최적화를 위해 작은 변화는 무시)
        const threshold = 0.001;
        const hasPositionChanged = 
            Math.abs(currentPosition[0] - lastPositionRef.current[0]) > threshold ||
            Math.abs(currentPosition[1] - lastPositionRef.current[1]) > threshold ||
            Math.abs(currentPosition[2] - lastPositionRef.current[2]) > threshold;
        
        if (hasPositionChanged && onPositionChangeRef.current) {
            lastPositionRef.current = currentPosition;
            onPositionChangeRef.current(currentPosition);
        }

        // 4. 카메라 회전이 변경되면 우주선 회전도 업데이트 (Y축만, 수평 회전)
        if (onRotationChangeRef.current) {
            const euler = new THREE.Euler(0, 0, 0, 'YXZ');
            if (isSpaceshipMode && cameraView !== 'firstPerson') {
                // 3인칭 시점에서는 우주선 회전 사용
                euler.copy(spaceshipRotationRef.current);
            } else {
                // 1인칭 시점에서는 카메라 회전 사용
                euler.setFromQuaternion(camera.quaternion);
            }
            // Y축 회전만 전달 (수평 회전만, X축과 Z축은 0으로 고정)
            const currentRotation: [number, number, number] = [0, euler.y, 0];
            onRotationChangeRef.current(currentRotation);
        }

        // 5. 속도 계산 및 콜백 전달 (일반 모드에서만)
        if (!isSpaceshipMode && onVelocityChangeRef.current) {
            const currentPos = new THREE.Vector3(
                camera.position.x,
                camera.position.y,
                camera.position.z
            );
            const velocityVector = currentPos.clone().sub(lastFramePositionRef.current);
            const speed = velocityVector.length(); // 속도의 크기 (스칼라)
            onVelocityChangeRef.current(speed);
            lastFramePositionRef.current.copy(currentPos);
        }

        // 6. 플레이어 모델 위치 업데이트 (일반 모드에서만)
        if (!isSpaceshipMode && playerModelRef.current) {
            playerModelRef.current.position.copy(playerModelPosition.current);
        }
    });

    // 간단한 사람 모델 렌더링 (일반 모드에서만)
    if (!isSpaceshipMode) {
        return (
            <group ref={playerModelRef} position={[playerModelPosition.current.x, playerModelPosition.current.y, playerModelPosition.current.z]}>
                {/* 머리 */}
                <mesh position={[0, 0.9, 0]} castShadow>
                    <sphereGeometry args={[0.15, 16, 16]} />
                    <meshStandardMaterial color="#ffdbac" />
                </mesh>
                {/* 몸통 */}
                <mesh position={[0, 0.5, 0]} castShadow>
                    <cylinderGeometry args={[0.12, 0.12, 0.6, 16]} />
                    <meshStandardMaterial color="#4a5568" />
                </mesh>
                {/* 왼팔 */}
                <mesh position={[-0.2, 0.6, 0]} rotation={[0, 0, 0.3]} castShadow>
                    <cylinderGeometry args={[0.04, 0.04, 0.4, 8]} />
                    <meshStandardMaterial color="#2d3748" />
                </mesh>
                {/* 오른팔 */}
                <mesh position={[0.2, 0.6, 0]} rotation={[0, 0, -0.3]} castShadow>
                    <cylinderGeometry args={[0.04, 0.04, 0.4, 8]} />
                    <meshStandardMaterial color="#2d3748" />
                </mesh>
                {/* 왼다리 */}
                <mesh position={[-0.08, 0.1, 0]} castShadow>
                    <cylinderGeometry args={[0.05, 0.05, 0.4, 8]} />
                    <meshStandardMaterial color="#2d3748" />
                </mesh>
                {/* 오른다리 */}
                <mesh position={[0.08, 0.1, 0]} castShadow>
                    <cylinderGeometry args={[0.05, 0.05, 0.4, 8]} />
                    <meshStandardMaterial color="#2d3748" />
                </mesh>
            </group>
        );
    }

    // 우주선 모드에서는 모델 없음
    return null;
}
