import React from 'react';
import { EffectComposer, Bloom, ChromaticAberration, Vignette } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';

const Effects = () => {
  return (
    <EffectComposer disableNormalPass multisampling={0}>
      {/* Bloom: Neon Glow */}
      <Bloom 
        luminanceThreshold={0.2} 
        mipmapBlur 
        intensity={1.5} 
        radius={0.6}
      />
      
      {/* Chromatic Aberration: Glitchy Edges */}
      <ChromaticAberration 
        offset={[0.002, 0.002]} // Slight shift
        blendFunction={BlendFunction.NORMAL}
        radialModulation={false}
        modulationOffset={0}
      />
      
      {/* Vignette: Focus center */}
      <Vignette 
        eskil={false} 
        offset={0.1} 
        darkness={0.7} 
      />
    </EffectComposer>
  );
};

export default Effects;
