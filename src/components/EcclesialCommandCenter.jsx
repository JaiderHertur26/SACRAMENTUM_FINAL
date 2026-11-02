import React, { useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Archive, Bell, BookOpen, ChartNoAxesCombined, ChevronRight,
  Church, Clock, Cross, Database, Droplets, FileSearch, FileText, Flame,
  FolderOpen, Heart, Mail, MessageCircleMore, Network, PenLine, Plus, RefreshCw, ScrollText,
  Search, Settings, ShieldCheck, SlidersHorizontal, Users, X,
} from 'lucide-react';
import { getCommandCenter } from '@/config/commandCenters';
import '@/styles/command-center.css';

const ICONS = {
  arrow: ArrowRight, archive: Archive, bell: Bell, book: BookOpen,
  chart: ChartNoAxesCombined, church: Church, clock: Clock, cross: Cross,
  database: Database, droplets: Droplets, file: FileText, fileSearch: FileSearch,
  flame: Flame, folder: FolderOpen, heart: Heart, chat: MessageCircleMore,
  network: Network, pen: PenLine, plus: Plus, search: Search, settings: Settings, mail: Mail, scroll: ScrollText,
  shield: ShieldCheck, sliders: SlidersHorizontal, users: Users,
};
const Symbol = ({ name, ...props }) => {
  const Icon = ICONS[name] || ArrowRight;
  return <Icon aria-hidden="true" {...props} />;
};

function Access({ item, commands, className = '', primary = false }) {
  const content = <>
    <Symbol name={item.icon} />
    <span>{item.label}</span>
    {item.value !== undefined && <strong className="cc-access-count">{item.value}</strong>}
    <ChevronRight className="cc-chevron" aria-hidden="true" />
  </>;
  const classes = className + (primary ? ' cc-access-primary' : '');
  if (item.to) return <Link to={item.to} className={classes}>{content}</Link>;
  if (typeof commands[item.command] !== 'function') return null;
  return <button type="button" className={classes} onClick={commands[item.command]}>{content}</button>;
}

export default function EcclesialCommandCenter({
  role, entityName, metrics = [], loading = false, error = false,
  attention = [], commands = {}, onRefresh,
}) {
  const config = getCommandCenter(role);
  const [selected, setSelected] = useState(null);
  const heading = useRef(null);
  const buttons = useRef({});
  const prefix = useId();
  if (!config) return null;
  const current = config.modules.find(item => item.id === selected);
  const panelId = prefix + '-actions';
  const open = item => {
    setSelected(item.id);
    requestAnimationFrame(() => heading.current?.focus());
  };
  const close = () => {
    const trigger = buttons.current[selected];
    setSelected(null);
    requestAnimationFrame(() => trigger?.focus());
  };
  const followUp = [...attention, ...config.followUp].filter((item, i, all) =>
    all.findIndex(candidate => candidate.to === item.to && candidate.label === item.label) === i
  );

  return (
    <section className="ecclesial-command-center" data-command-center-role={role}
      aria-labelledby={prefix + '-title'}
      onKeyDown={event => {
        if (event.key === 'Escape' && current && !event.defaultPrevented) {
          event.preventDefault();
          close();
        }
      }}>
      <header className="cc-heading">
        <div>
          <p className="cc-eyebrow"><Cross size={14} aria-hidden="true" />{config.eyebrow}</p>
          <h1 id={prefix + '-title'}>Centro de mando</h1>
          <p className="cc-entity">{entityName || config.eyebrow}</p>
          <p className="cc-description">{config.description}</p>
        </div>
        <button type="button" className="cc-refresh" disabled={loading}
          onClick={onRefresh || (() => window.location.reload())}>
          <RefreshCw size={16} aria-hidden="true" className={loading ? 'cc-spinning' : ''} />
          <span>Actualizar</span>
        </button>
      </header>

      <Link className="cc-search" to="/buscar">
        <Search size={21} aria-hidden="true" />
        <span>Buscar personas, partidas o documentos</span>
        <span className="cc-search-open">Abrir buscador <ArrowRight size={16} aria-hidden="true" /></span>
      </Link>

      {error && <p className="cc-error" role="alert">No fue posible actualizar los datos. Intenta actualizar de nuevo.</p>}
      <div className="cc-metrics" aria-label="Resumen del despacho" aria-busy={loading}>
        {metrics.map(item => {
          const content = <>
            <Symbol name={item.icon} />
            <span><strong>{loading || error ? '—' : item.value}</strong><span>{item.label}</span></span>
            {item.to && <ChevronRight className="cc-chevron" aria-hidden="true" />}
          </>;
          return item.to
            ? <Link to={item.to} className="cc-metric" key={item.label}>{content}</Link>
            : <div className="cc-metric" key={item.label}>{content}</div>;
        })}
      </div>

      <div className="cc-workarea">
        <aside className="cc-aside" aria-label="Acciones y seguimiento">
          {current ? (
            <section className="cc-action-panel" id={panelId} aria-labelledby={prefix + '-panel-title'}>
              <div className="cc-panel-topline">
                <p className="cc-eyebrow">Acciones del área</p>
                <button type="button" className="cc-close" onClick={close} aria-label="Cerrar acciones"><X size={19} aria-hidden="true" /></button>
              </div>
              <h2 ref={heading} tabIndex={-1} id={prefix + '-panel-title'}>{current.label}</h2>
              <p className="cc-panel-description">{current.description}</p>
              <div className="cc-action-list">
                {current.actions.map((item, index) =>
                  <Access key={item.label} item={item} commands={commands} className="cc-action" primary={index === 0} />)}
              </div>
            </section>
          ) : (
            <section className="cc-welcome">
              <span className="cc-welcome-symbol"><Church size={27} aria-hidden="true" /></span>
              <p className="cc-eyebrow">Al servicio de la Iglesia</p>
              <h2>Su despacho,<br />en un solo lugar.</h2>
              <p>Seleccione un área para acceder a sus acciones.</p>
            </section>
          )}
          <section className="cc-followup" aria-labelledby={prefix + '-followup-title'}>
            <h2 id={prefix + '-followup-title'}>{config.followUpTitle}</h2>
            {followUp.map((item, index) => <Access key={item.label + index} item={item} commands={commands} className="cc-followup-link" />)}
          </section>
        </aside>

        <div className="cc-main">
          <div className="cc-section-heading">
            <h2>{config.sectionTitle}</h2>
            <span>{config.modules.length} áreas de servicio</span>
          </div>
          <div className="cc-modules">
            {config.modules.map(item => (
              <button type="button" key={item.id} className={'cc-module' + (current?.id === item.id ? ' is-selected' : '')}
                ref={node => { buttons.current[item.id] = node; }}
                onClick={() => open(item)} aria-expanded={current?.id === item.id}
                aria-controls={current?.id === item.id ? panelId : undefined}
                aria-label={'Abrir acciones de ' + item.label}>
                <Symbol name={item.icon} className="cc-module-icon" />
                <span className="cc-module-content">
                  <span className="cc-module-rule" />
                  <strong>{item.label}</strong>
                  <span className="cc-module-description">{item.description}</span>
                  <span className="cc-module-open">Abrir acciones<ChevronRight size={17} aria-hidden="true" /></span>
                </span>
              </button>
            ))}
          </div>
          {config.shortcuts.length > 0 && <section className="cc-shortcut-section">
            <h2>{config.shortcutTitle}</h2>
            <div className="cc-shortcuts">
              {config.shortcuts.map(item => <Access key={item.label} item={item} commands={commands} className="cc-shortcut" />)}
            </div>
          </section>}
          <p className="cc-mission"><span aria-hidden="true">✝</span> Al servicio de la memoria y la misión de la Iglesia.</p>
        </div>
      </div>
    </section>
  );
}
