/**
 * Small pieces the study page shows only in preview mode (study builder).
 */
import React from 'react';
import { L2Root, NoticeCard } from '../v2/components';

export function PreviewEnd({ onRestart }) {
  return (
    <L2Root dir="ltr">
      <NoticeCard
        message={'**End of the study.** This is a preview, so nothing was saved. Participants see the final page here.'}
        actionLabel="Start again"
        onAction={() => (onRestart ? onRestart() : window.location.reload())}
      />
    </L2Root>
  );
}

export function PreviewNotice({ onNext }) {
  return (
    <L2Root dir="ltr">
      <NoticeCard
        message={'**Multiplayer game.** It can only be played once the study is published (the server reads the game settings from the published file). Try it then at the study\'s link, in two windows.'}
        actionLabel="Skip to the next page"
        onAction={onNext}
      />
    </L2Root>
  );
}
