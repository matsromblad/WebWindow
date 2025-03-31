# Virtual Glass Window - Proof of Concept Plan

## Overview

This proof of concept (POC) will demonstrate the core parallax effect that creates the illusion of looking through a real window. We'll strip down the project to its essential components while ensuring the main effect is showcased effectively.

## Core Concept

The POC will focus on:
1. Basic head tracking through webcam
2. Simple parallax effect with 3-5 depth layers
3. One basic environment scene
4. Minimal window frame

## Technical Implementation

### 1. Simplified Project Structure

```
VirtualGlassWindow_POC/
├── Content/
│   ├── Blueprints/
│   │   ├── Core/
│   │   │   └── BP_POC_GameMode.uasset
│   │   ├── Player/
│   │   │   ├── BP_HeadTracker_Basic.uasset
│   │   │   └── BP_ParallaxCamera_Basic.uasset
│   │   └── Window/
│   │       └── BP_SimpleWindow.uasset
│   ├── Materials/
│   │   ├── M_SimpleGlass.uasset
│   │   └── M_WindowFrame.uasset
│   ├── Maps/
│   │   └── POC_Scene.uasset
│   ├── Meshes/
│   │   ├── SM_WindowFrame.uasset
│   │   └── SM_Glass.uasset
│   └── Textures/
│       ├── T_SceneLayer1.uasset
│       ├── T_SceneLayer2.uasset
│       ├── T_SceneLayer3.uasset
│       └── T_Skybox.uasset
├── Config/
└── Source/
```

### 2. Head Tracking Implementation

Create a simplified head tracking system that:
- Captures webcam input
- Detects basic face position (X/Y coordinates only)
- Smooths movement data
- Provides position data to the parallax system

```cpp
// Pseudo-code for simplified head tracking
void BP_HeadTracker_Basic::ProcessWebcamImage()
{
    // Use simplified face detection algorithm (OpenCV or similar)
    FVector2D facePosition = DetectFaceCenter(WebcamImage);
    
    // Apply simple smoothing
    CurrentPosition = FMath::Lerp(CurrentPosition, facePosition, SmoothingFactor);
    
    // Pass to parallax controller
    ParallaxController->UpdateParallaxOffset(CurrentPosition);
}
```

### 3. Parallax System

Implement a basic parallax system with:
- 3-5 depth layers (foreground, middle ground, background)
- Simple offset calculation based on head position
- Layered image planes with transparency

```cpp
// Pseudo-code for parallax controller
void BP_ParallaxController_Basic::UpdateParallaxOffset(FVector2D HeadPosition)
{
    // Calculate offset from neutral position
    FVector2D offsetFromNeutral = HeadPosition - NeutralPosition;
    
    // Update each layer with appropriate depth multiplier
    for (int i = 0; i < SceneLayers.Num(); i++)
    {
        float depthFactor = LayerDepths[i];
        FVector2D layerOffset = offsetFromNeutral * depthFactor;
        
        // Apply offset to layer (inverted to create correct parallax effect)
        SceneLayers[i]->SetRelativeLocation(FVector(-layerOffset.X, -layerOffset.Y, 0));
    }
}
```

### 4. Environment Scene

Create a single simple environment scene:
- Layer 1 (Foreground): Window frame and optional window elements
- Layer 2: Near elements (e.g., close trees/objects)
- Layer 3: Mid-distance elements
- Layer 4: Far background
- Layer 5: Skybox

For the POC, using a set of pre-rendered transparent images for each layer will be sufficient.

### 5. Window Frame

Implement a basic window frame:
- Simple geometry with a frame and glass pane
- Basic glass material with subtle reflection
- Positioned as the closest layer to the viewer

## Testing and Validation

The POC should be tested to validate:
1. Head tracking responsiveness
2. Convincing parallax effect
3. Performance on minimum spec hardware

Success criteria: Users should experience a compelling illusion of depth when moving their head, similar to looking through a real window.

## Next Steps After POC

If the proof of concept is successful, these would be the logical next steps:
1. Refine head tracking for better accuracy and performance
2. Add window customization options
3. Implement the first complete environment
4. Develop the glass material system with basic effects

## Implementation Plan

1. **Day 1-2**: Set up project and implement basic head tracking
2. **Day 3-4**: Create parallax system and layer management
3. **Day 5-6**: Develop simple environment assets and window frame
4. **Day 7**: Integration testing and refinement

Total estimated time: 1-2 weeks for a working proof of concept
