import { useEffect, useState, useCallback } from 'react';
import './ReactionFloatLayer.css';

let nextId = 0;

/**
 * Fires a floating emoji when `trigger` changes (new object each reaction).
 */
export default function ReactionFloatLayer({ trigger }) {
  const [particles, setParticles] = useState([]);

  const pushParticle = useCallback((payload) => {
    const id = ++nextId;
    const x = 8 + Math.random() * 84;
    const delay = Math.random() * 0.12;
    setParticles((p) => [...p, { id, ...payload, x, delay }]);
    window.setTimeout(() => {
      setParticles((p) => p.filter((item) => item.id !== id));
    }, 2800);
  }, []);

  useEffect(() => {
    if (!trigger?.emoji) return;
    pushParticle(trigger);
  }, [trigger, pushParticle]);

  return (
    <div className="reaction-float-layer" aria-hidden>
      {particles.map((p) => (
        <div
          key={p.id}
          className="reaction-float-layer__particle"
          style={{
            left: `${p.x}%`,
            animationDelay: `${p.delay}s`,
          }}
        >
          <span className="reaction-float-layer__emoji">{p.emoji}</span>
        </div>
      ))}
    </div>
  );
}
