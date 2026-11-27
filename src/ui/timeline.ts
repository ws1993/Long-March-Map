/**
 * 底部时间轴：把 1934-10-10 → 1936-10-22 这段历史时间映射到 0..1000 的滑块，
 * 支持拖动、播放、变速，并在轨道上标出关键节点刻度。
 */
import type { StoryNode } from '../data/types';

const DAY = 86400000;

export interface TimelineChangeMeta {
  /** 是否属于点击节点等离散跳转（可用于路线平滑追赶过渡） */
  jump?: boolean;
}

export interface TimelineOptions {
  start: string;
  end: string;
  markers: StoryNode[];
  /** 1× 速度下播完整段所需秒数 */
  durationSeconds?: number;
  /** 可选的场景自适应时间速率倍率（如进入关键战役时放慢时间流速以便看清动态态势） */
  rateFactorAt?: (tsMs: number, speed: number) => number;
  onDate: (iso: string, tsMs: number, meta: TimelineChangeMeta) => void;
}

export class Timeline {
  readonly startTs: number;
  readonly endTs: number;
  private current = 0; // 0..1000
  private playing = false;
  private speed = 1;
  private raf = 0;
  private lastFrame = 0;
  private markerEls: HTMLElement[] = [];

  private slider: HTMLInputElement;
  private fill: HTMLElement;
  private tickBox: HTMLElement;
  private playBtn: HTMLButtonElement;
  private clockDate: HTMLElement;
  private clockSub: HTMLElement;

  constructor(private opts: TimelineOptions) {
    this.startTs = Date.parse(`${opts.start}T00:00:00Z`);
    this.endTs = Date.parse(`${opts.end}T00:00:00Z`);

    this.slider = document.getElementById('time-slider') as HTMLInputElement;
    this.fill = document.getElementById('track-fill') as HTMLElement;
    this.tickBox = document.getElementById('track-ticks') as HTMLElement;
    this.playBtn = document.getElementById('btn-play') as HTMLButtonElement;
    this.clockDate = document.getElementById('clock-date') as HTMLElement;
    this.clockSub = document.getElementById('clock-sub') as HTMLElement;

    this.buildTicks();
    this.bind();
    this.setValue(0, true);
  }

  private buildTicks() {
    const majors = new Set([
      'n-ruijin',
      'n-zunyi',
      'n-luding',
      'n-grassland',
      'n-wuqi',
      'n-huining',
    ]);
    const frag = document.createDocumentFragment();
    for (const node of this.opts.markers) {
      const ts = Date.parse(`${node.date}T00:00:00Z`);
      if (Number.isNaN(ts)) continue;
      const p = this.toPc(ts);
      const el = document.createElement('div');
      const major = majors.has(node.id);
      el.className = `lm-track__tick${major ? ' is-major' : ''}`;
      el.style.left = `${p * 100}%`;
      el.dataset.label = major ? node.name : '';
      el.title = `${node.date} ${node.name}`;
      frag.appendChild(el);
      this.markerEls.push(el);
    }
    this.tickBox.appendChild(frag);
  }

  private bind() {
    this.slider.addEventListener('input', () => {
      this.pause();
      this.setValue(Number(this.slider.value) / 1000, false);
    });

    this.playBtn.addEventListener('click', () => {
      if (this.playing) this.pause();
      else this.play();
    });

    document.querySelectorAll<HTMLButtonElement>('.lm-speed button').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.speed = Number(btn.dataset.speed ?? '1');
        document.querySelectorAll('.lm-speed button').forEach((b) => b.classList.toggle('is-on', b === btn));
      });
    });
  }

  private toPc(ts: number): number {
    return Math.max(0, Math.min(1, (ts - this.startTs) / (this.endTs - this.startTs)));
  }

  private toTs(pc: number): number {
    return this.startTs + (this.endTs - this.startTs) * pc;
  }

  setValue(pc: number, silent: boolean, meta: TimelineChangeMeta = {}) {
    this.current = Math.max(0, Math.min(1, pc));
    this.slider.value = String(Math.round(this.current * 1000));
    this.fill.style.width = `${this.current * 100}%`;

    const ts = this.toTs(this.current);
    const iso = new Date(ts).toISOString().slice(0, 10);

    const d = new Date(ts);
    this.clockDate.textContent = `${d.getUTCFullYear()} 年 ${d.getUTCMonth() + 1} 月 ${d.getUTCDate()} 日`;

    // 找到当前日期下"最后发生"的一件大事，作为时间轴的副标题
    let latest: StoryNode | null = null;
    for (const node of this.opts.markers) {
      const nts = Date.parse(`${node.date}T00:00:00Z`);
      if (!Number.isNaN(nts) && nts <= ts) {
        if (!latest || nts > Date.parse(`${latest.date}T00:00:00Z`)) latest = node;
      }
    }
    this.clockSub.textContent = latest ? latest.brief : '长征尚未开始';

    for (let i = 0; i < this.markerEls.length; i++) {
      const node = this.opts.markers[i];
      if (!node) continue;
      const nts = Date.parse(`${node.date}T00:00:00Z`);
      this.markerEls[i].classList.toggle('is-passed', !Number.isNaN(nts) && nts <= ts);
    }

    void silent;
    this.opts.onDate(iso, ts, meta);
  }

  setDate(iso: string, jump = true) {
    const ts = Date.parse(`${iso}T00:00:00Z`);
    if (Number.isNaN(ts)) return;
    this.pause();
    this.setValue(this.toPc(ts), false, { jump });
  }

  play() {
    if (this.playing) return;
    if (this.current >= 0.999) this.setValue(0, false);
    this.playing = true;
    this.playBtn.classList.add('is-playing');
    this.lastFrame = performance.now();
    const durationMs = (this.opts.durationSeconds ?? 52) * 1000;
    const tick = (t: number) => {
      if (!this.playing) return;
      const dt = Math.min(120, t - this.lastFrame);
      this.lastFrame = t;
      const curTs = this.toTs(this.current);
      const sceneRate = this.opts.rateFactorAt ? this.opts.rateFactorAt(curTs, this.speed) : 1;
      const next = this.current + (dt / durationMs) * this.speed * sceneRate;
      if (next >= 1) {
        this.setValue(1, false);
        this.pause();
        return;
      }
      this.setValue(next, false);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  pause() {
    this.playing = false;
    this.playBtn.classList.remove('is-playing');
    cancelAnimationFrame(this.raf);
  }

  get isPlaying() {
    return this.playing;
  }

  get currentDate(): string {
    return new Date(this.toTs(this.current)).toISOString().slice(0, 10);
  }

  get currentSpeed(): number {
    return this.speed;
  }
}

export { DAY };
