import type { GameEvent } from '../core/types';
import { drawToken, clamp, easeOutCubic, lerp, roundedRect } from './RenderPrimitives';

export interface Flight {
  readonly typeId: string;
  readonly from: { readonly x: number; readonly y: number };
  readonly to: { readonly x: number; readonly y: number };
  readonly size: number;
  readonly startedAt: number;
  readonly duration: number;
  readonly store: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  angle: number;
  spin: number;
  big: boolean;
}

/** Original Demo flight arcs and particles, driven exclusively by GameEvent. */
export class EffectsRenderer {
  private flights: Flight[] = [];
  private particles: Particle[] = [];
  private lastFrame = performance.now();

  public get active(): boolean {
    return this.flights.length > 0 || this.particles.length > 0;
  }

  public clear(): void {
    this.flights = [];
    this.particles = [];
    this.lastFrame = performance.now();
  }

  public addFlight(flight: Flight): void {
    this.flights.push(flight);
  }

  public burst(x: number, y: number, colors: readonly string[], count = 10, big = false): void {
    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (big ? 90 : 40) + Math.random() * (big ? 190 : 70);
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (big ? 100 : 20),
        life: 0,
        max: (big ? 1.8 : 0.55) + Math.random() * 0.4,
        size: (big ? 3 : 1.8) + Math.random() * 2,
        color: colors[index % colors.length] ?? '#ffffff',
        angle: Math.random() * 6,
        spin: Math.random() * 7 - 3.5,
        big,
      });
    }
  }

  public draw(ctx: CanvasRenderingContext2D, now: number, reducedMotion: boolean): void {
    const dt = Math.min(0.04, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.drawFlights(ctx, now);
    if (!reducedMotion) this.drawParticles(ctx, dt);
  }

  private drawFlights(ctx: CanvasRenderingContext2D, now: number): void {
    const remaining: Flight[] = [];
    for (const flight of this.flights) {
      const progress = clamp((now - flight.startedAt) / flight.duration);
      const eased = easeOutCubic(progress);
      const direction = flight.to.x - flight.from.x > 0 ? 1 : -1;
      const x = lerp(flight.from.x, flight.to.x, eased) + direction * Math.sin(progress * Math.PI) * 13;
      const y = lerp(flight.from.y, flight.to.y, eased) - Math.sin(progress * Math.PI) * 45;
      drawToken(ctx, x, y, lerp(flight.size, 35, eased), flight.typeId, {
        scale: 1 + Math.sin(progress * Math.PI) * 0.1,
        angle: Math.sin(progress * Math.PI) * (flight.to.x - flight.from.x) * 0.0006,
        shadow: false,
      });
      if (progress < 1) remaining.push(flight);
      else if (!flight.store) this.burst(flight.to.x, flight.to.y, ['#ffffff', '#fff4c4', '#deedac'], 9);
    }
    this.flights = remaining;
  }

  private drawParticles(ctx: CanvasRenderingContext2D, dt: number): void {
    const remaining: Particle[] = [];
    for (const particle of this.particles) {
      particle.life += dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += (particle.big ? 155 : 80) * dt;
      particle.angle += particle.spin * dt;
      if (particle.life >= particle.max) continue;
      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.angle);
      ctx.globalAlpha = clamp(1 - particle.life / particle.max);
      ctx.fillStyle = particle.color;
      if (particle.big) {
        roundedRect(ctx, -particle.size, -particle.size * 0.5, particle.size * 2, particle.size, 1);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(0, -particle.size * 1.8);
        ctx.quadraticCurveTo(particle.size * 0.25, -particle.size * 0.25, particle.size * 1.2, 0);
        ctx.quadraticCurveTo(particle.size * 0.25, particle.size * 0.25, 0, particle.size * 1.8);
        ctx.quadraticCurveTo(-particle.size * 0.25, particle.size * 0.25, -particle.size * 1.2, 0);
        ctx.quadraticCurveTo(-particle.size * 0.25, -particle.size * 0.25, 0, -particle.size * 1.8);
        ctx.fill();
      }
      ctx.restore();
      remaining.push(particle);
    }
    this.particles = remaining;
  }
}
