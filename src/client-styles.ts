// 复用 Harness 的颜色、圆角和交互令牌；作用域限定在插件面板内。
// 显式使用宿主控件的 14px / 22px 尺寸，避免继承容器的大字号。
export const styles = `
.recheck .rc-diagnostics { margin: 0 0 16px; padding: 10px 12px; border: 1px solid var(--rc-line); border-radius: 8px; overflow-wrap: anywhere; }
.recheck .rc-diagnostics summary { cursor: pointer; font-weight: 500; }
.recheck .rc-diagnostics p { margin: 10px 0; }
.recheck .rc-diagnostics textarea { margin: 8px 0; font: 12px/1.5 monospace; }
.recheck {
  --rc-text: var(--dsw-alias-label-primary, #17191d);
  --rc-muted: var(--dsw-alias-label-tertiary, #727780);
  --rc-line: var(--dsw-alias-border-l3, #e2e4e8);
  --rc-surface: var(--dsw-alias-bg-layer-1, #fff);
  --rc-soft: var(--dsw-alias-bg-module-platform, #f5f6f8);
  --rc-hover: var(--dsw-alias-interactive-bg-hover, #eef0f4);
  --rc-accent: var(--dsw-alias-state-business-primary, #4d6bfe);
  --rc-radius: var(--dsw-radius-md, 12px);
  width: 100%; height: 100%; min-width: 0; overflow: auto;
  padding: 20px; box-sizing: border-box; container-type: inline-size;
  color: var(--rc-text); background: var(--dsw-alias-bg-base, #fff);
  font-family: var(--dsw-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif);
  font-size: 14px; line-height: 22px;
  scrollbar-width: thin; scrollbar-color: var(--rc-line) transparent;
}
.recheck *, .recheck *::before, .recheck *::after { box-sizing: border-box; }
.recheck [hidden] { display: none !important; }
.recheck .rc-body { width: 100%; max-width: 920px; margin: 0 auto; }
.recheck h2, .recheck h3, .recheck h4, .recheck p { margin: 0; overflow-wrap: anywhere; }
.recheck h2 { font-size: 18px; line-height: 26px; font-weight: 600; letter-spacing: -.3px; }
.recheck h3 { font-size: 18px; line-height: 26px; font-weight: 600; }
.recheck h4 { font-size: 14px; line-height: 22px; font-weight: 600; margin: 18px 0 8px; }
.recheck svg { width: 16px; height: 16px; flex-shrink: 0; }
.recheck button {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  min-height: 32px; padding: 5px 12px; max-width: 100%;
  border: .5px solid var(--rc-line); border-radius: var(--rc-radius);
  background: transparent; color: var(--rc-text); font: inherit; line-height: 22px;
  cursor: pointer; transition: background-color .15s, border-color .15s;
}
.recheck button:hover:not(:disabled) { background: var(--rc-hover); }
.recheck button:disabled { opacity: .4; cursor: not-allowed; }
.recheck button.rc-primary {
  background: var(--dsw-alias-button-primary-fill, #202329);
  color: var(--dsw-alias-label-primary-foreground, #fff); border-color: transparent;
}
.recheck button.rc-primary:hover:not(:disabled) { background: var(--dsw-alias-button-primary-hover, #393e47); }
.recheck button.rc-ghost { border-color: transparent; }
.recheck button.rc-icon { width: 32px; padding: 7px; flex-shrink: 0; }
.recheck :focus-visible { outline: 2px solid var(--rc-accent); outline-offset: 3px; }
.recheck input, .recheck textarea, .recheck select {
  width: 100%; min-width: 0; max-width: 100%; margin: 0;
  border: .5px solid var(--dsw-alias-border-l4, #d9dce1);
  border-radius: var(--rc-radius); padding: 8px 11px;
  font: inherit; line-height: 22px; color: var(--rc-text); background: var(--rc-surface);
}
.recheck input::placeholder, .recheck textarea::placeholder { color: var(--rc-muted); opacity: .8; }
.recheck input:focus, .recheck textarea:focus, .recheck select:focus { border-color: var(--rc-accent); }
.recheck textarea { display: block; resize: vertical; min-height: 88px; }
.recheck input[type=checkbox] { width: 15px; height: 15px; padding: 0; margin: 0; accent-color: var(--rc-accent); flex-shrink: 0; }
.recheck select { min-height: 34px; padding: 5px 9px; }
.recheck label { display: block; }
.recheck .rc-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 18px; }
.recheck .rc-brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
.recheck .rc-logo { display: grid; place-items: center; width: 36px; height: 36px; background: var(--rc-soft); border-radius: var(--rc-radius); flex-shrink: 0; }
.recheck .rc-logo svg { width: 20px; height: 20px; }
.recheck .rc-subtitle { font-size: 12px; line-height: 18px; color: var(--rc-muted); }
.recheck .rc-project { display: flex; align-items: flex-start; gap: 7px; color: var(--rc-muted); font-size: 12px; line-height: 18px; padding: 10px 12px; border-radius: var(--rc-radius); background: var(--rc-soft); margin-bottom: 18px; }
.recheck .rc-project svg { margin-top: 1px; }
.recheck .rc-project p { min-width: 0; }
.recheck .rc-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.recheck .rc-notice { padding: 10px 12px; border-radius: var(--rc-radius); background: var(--rc-soft); font-size: 12px; line-height: 20px; margin-bottom: 14px; }
.recheck .rc-notice:empty { display: none; }
.recheck [role=alert] { border: 1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary, #dc3434) 35%, transparent); }
.recheck [role=status]:not(:empty) { border-left: 3px solid var(--rc-accent); }
.recheck .rc-cancel { margin-bottom: 14px; }
.recheck .rc-overview { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-bottom: 20px; }
.recheck .rc-stat { background: var(--rc-soft); border-radius: var(--rc-radius); padding: 12px; }
.recheck .rc-stat > span { display: block; font-size: 12px; line-height: 18px; color: var(--rc-muted); }
.recheck .rc-stat strong { display: block; margin-top: 3px; font-size: 24px; line-height: 30px; font-weight: 600; font-variant-numeric: tabular-nums; }
.recheck .rc-stat small { font-size: 12px; font-weight: 400; color: var(--rc-muted); margin-left: 3px; }
.recheck .rc-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; padding-bottom: 12px; }
.recheck .rc-tabs { display: flex; gap: 4px; background: var(--rc-soft); padding: 3px; border-radius: var(--rc-radius); }
.recheck .rc-tabs button { min-height: 28px; padding: 2px 12px; font-size: 12px; border-color: transparent; border-radius: var(--dsw-radius-sm, 8px); color: var(--rc-muted); }
.recheck .rc-tabs button[aria-pressed=true] { background: var(--rc-surface); color: var(--rc-text); box-shadow: 0 1px 3px #0000000a; }
.recheck .rc-check-all { font-size: 12px; }
.recheck .rc-filters { display: grid; grid-template-columns: minmax(120px, 1fr) minmax(118px, .6fr); gap: 8px; }
.recheck .rc-search { position: relative; }
.recheck .rc-search svg { position: absolute; left: 10px; top: 10px; color: var(--rc-muted); pointer-events: none; }
.recheck .rc-search input { height: 36px; padding: 6px 10px 6px 34px; }
.recheck .rc-filter-bottom { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin: 12px 0 18px; }
.recheck .rc-checkbox { display: flex; align-items: center; gap: 7px; font-size: 12px; line-height: 18px; cursor: pointer; }
.recheck .rc-muted { color: var(--rc-muted); font-size: 12px; line-height: 20px; }
.recheck .rc-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; padding: 40px 16px; border: .5px dashed var(--rc-line); border-radius: var(--rc-radius); }
.recheck .rc-empty-icon { width: 48px; height: 48px; display: grid; place-items: center; border-radius: 16px; background: var(--rc-soft); color: var(--rc-muted); margin-bottom: 3px; }
.recheck .rc-empty-icon svg { width: 24px; height: 24px; }
.recheck .rc-empty h3 { font-size: 15px; line-height: 22px; }
.recheck .rc-empty p { max-width: 280px; color: var(--rc-muted); font-size: 12px; line-height: 20px; }
.recheck .rc-list { display: grid; gap: 10px; }
.recheck .rc-card { border: .5px solid var(--rc-line); border-radius: var(--rc-radius); padding: 14px; transition: border-color .15s; }
.recheck .rc-card:hover { border-color: var(--dsw-alias-border-l4, #c8ccd3); }
.recheck button.card-title { display: flex; text-align: left; justify-content: space-between; width: 100%; border: none; border-radius: var(--dsw-radius-sm, 8px); padding: 0; min-height: 24px; font-weight: 600; margin-bottom: 8px; }
.recheck .card-title span { overflow-wrap: anywhere; min-width: 0; }
.recheck .card-title svg { color: var(--rc-muted); }
.recheck .rc-badges { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; font-size: 11px; line-height: 18px; margin: 8px 0; }
.recheck .rc-badge { display: inline-flex; align-items: center; gap: 5px; padding: 2px 7px; background: var(--rc-soft); border-radius: var(--dsw-radius-sm, 8px); font-weight: 400; }
.recheck .rc-badge::before { content: ''; width: 5px; height: 5px; border-radius: 50%; background: var(--rc-muted); }
.recheck .rc-badge[data-state=unchanged]::before { background: var(--dsw-alias-state-success-primary, #24a06b); }
.recheck .rc-badge[data-state=changed]::before { background: var(--dsw-alias-state-warn-primary, #df9828); }
.recheck .rc-badge[data-state=missing]::before { background: var(--dsw-alias-state-error-primary, #d94444); }
.recheck .rc-claim { white-space: pre-wrap; margin: 10px 0; overflow-wrap: anywhere; }
.recheck .rc-card .rc-claim { color: var(--dsw-alias-label-secondary, #555b65); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.recheck .rc-meta { color: var(--rc-muted); font-size: 11px; line-height: 20px; }
.recheck .rc-stamp button { min-height: 18px; padding: 0 4px; border: none; font-size: 10px; line-height: 18px; color: var(--rc-muted); border-radius: 4px; }
.recheck .rc-stamp small { display: block; font-size: 11px; }
.recheck .rc-form-heading { margin: 20px 0 16px; }
.recheck .rc-form-heading p { margin-top: 5px; }
.recheck .rc-draft { display: flex; gap: 8px; align-items: flex-start; color: var(--rc-muted); font-size: 12px; line-height: 20px; margin-bottom: 20px; }
.recheck .rc-draft svg { margin-top: 2px; }
.recheck .rc-form-section { border: .5px solid var(--rc-line); border-radius: var(--rc-radius); padding: 16px; margin: 0 0 14px; min-width: 0; }
.recheck .rc-form-section h4 { margin: 0 0 14px; }
.recheck .rc-field + .rc-field { margin-top: 18px; }
.recheck .rc-field-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 7px; }
.recheck .rc-field-head label { font-size: 13px; font-weight: 500; }
.recheck .rc-required { color: var(--rc-accent); margin-left: 4px; }
.recheck .rc-count { font-size: 11px; line-height: 18px; color: var(--rc-muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
.recheck .rc-count[data-over=true] { color: var(--dsw-alias-state-error-primary, #dc3434); }
.recheck .rc-field .rc-muted { margin-top: 6px; }
.recheck .rc-file-input { font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Consolas, monospace); font-size: 12px; line-height: 21px; }
.recheck .rc-form-footer { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding: 12px 0 4px; }
.recheck .rc-footer-note { max-width: 230px; }
.recheck .rc-detail { display: grid; gap: 12px; }
.recheck .rc-detail > p { color: var(--dsw-alias-label-secondary, #555b65); font-size: 12px; }
.recheck .rc-detail > .rc-claim { color: var(--rc-text); font-size: 14px; background: var(--rc-soft); padding: 14px; border-radius: var(--rc-radius); }
.recheck .rc-detail article { border: .5px solid var(--rc-line); border-radius: var(--rc-radius); padding: 12px; font-size: 12px; }
.recheck .rc-detail article p { margin: 6px 0; }
.recheck details { font-size: 12px; }
.recheck summary { cursor: pointer; color: var(--rc-muted); padding: 6px 0; }
.recheck pre { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 11px; line-height: 18px; }
.recheck fieldset { min-width: 0; border: .5px solid var(--rc-line); border-radius: var(--rc-radius); padding: 14px; margin: 12px 0; display: grid; gap: 12px; }
.recheck legend { font-size: 13px; padding: 0 6px; }
.recheck fieldset.rc-form-fields { display: block; border: 0; padding: 0; margin: 0; }
.recheck .rc-file-errors { padding-left: 18px; margin: 8px 0; font-size: 12px; overflow-wrap: anywhere; color: var(--dsw-alias-state-error-primary, #dc3434); }
.recheck .rc-file-errors:empty { display: none; }
.recheck .rc-file-errors button { padding: 0; border: 0; background: none; color: inherit; text-decoration: underline; }
.recheck [aria-invalid=true] { border-color: var(--dsw-alias-state-error-primary, #dc3434); }
.recheck fieldset label > input:not([type=checkbox]), .recheck fieldset textarea { margin-top: 6px; }
@container (max-width: 360px) {
  .recheck .rc-header { align-items: flex-start; }
  .recheck .rc-header .rc-primary { font-size: 12px; padding: 5px 9px; }
  .recheck .rc-logo { display: none; }
  .recheck .rc-filters { grid-template-columns: 1fr; }
  .recheck .rc-stat { padding: 10px; }
  .recheck .rc-stat strong { font-size: 21px; }
  .recheck .rc-form-section { padding: 12px; }
  .recheck .rc-form-footer { align-items: flex-start; flex-direction: column-reverse; }
}
@media (prefers-reduced-motion: reduce) { .recheck * { transition: none !important; } }
`
