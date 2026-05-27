function Panel({ title, children, delayClass = '' }) {
  return (
    <div className={`room-bottom__panel animate-fade-in-up opacity-0 ${delayClass} hover:-translate-y-1 hover:shadow-xl hover:border-white/20 transition-all duration-300 ease-apple`}>
      <h2 className="room-bottom__panel-title">{title}</h2>
      <div className="room-bottom__panel-body">{children}</div>
    </div>
  );
}

/**
 * Three panels: call, chat, participants — flex row on desktop, column on mobile.
 */
export default function BottomPanels({ videoCall, chat, participants }) {
  return (
    <section className="room-bottom">
      <Panel title="Video call" delayClass="animation-delay-50">{videoCall}</Panel>
      <Panel title="Chat" delayClass="animation-delay-100">{chat}</Panel>
      <Panel title="Participants" delayClass="animation-delay-150">{participants}</Panel>
    </section>
  );
}
