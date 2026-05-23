function Panel({ title, children }) {
  return (
    <div className="room-bottom__panel">
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
      <Panel title="Video call">{videoCall}</Panel>
      <Panel title="Chat">{chat}</Panel>
      <Panel title="Participants">{participants}</Panel>
    </section>
  );
}
