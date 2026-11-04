import { useState } from "react";
import { Flex } from "@chakra-ui/react";
import { gql, Q } from "../api.js";
import { usePolling } from "../hooks.js";
import ChannelSidebar from "./ChannelSidebar.jsx";
import ChatPanel from "./ChatPanel.jsx";
import CreateChannelDialog from "./CreateChannelDialog.jsx";

const CHANNELS_POLL_MS = 10_000;

export default function Workspace({ user }) {
  const [channels, setChannels] = useState(null);
  const [error, setError] = useState(null);
  const [channelId, setChannelId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);

  const refresh = usePolling(
    async (cancelled) => {
      try {
        const data = await gql(Q.channels);
        if (cancelled()) return;
        setChannels(data.channels);
        setError(null);
      } catch (e) {
        if (!cancelled()) setError(e.message);
      }
    },
    CHANNELS_POLL_MS,
    true,
    user.id
  );

  const selected = channels?.find((c) => c.id === channelId) ?? null;

  const handleCreated = (channel) => {
    setChannels((prev) => [...(prev ?? []), channel]);
    setChannelId(channel.id);
    setCreateOpen(false);
    refresh();
  };

  return (
    <Flex flex="1" minH="0" w="full">
      <ChannelSidebar
        channels={channels}
        error={error}
        selectedId={channelId}
        onSelect={setChannelId}
        onCreate={() => setCreateOpen(true)}
        onRetry={refresh}
        hiddenOnMobile={!!selected}
      />
      <ChatPanel user={user} channel={selected} onBack={() => setChannelId(null)} hiddenOnMobile={!selected} />
      <CreateChannelDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={handleCreated} />
    </Flex>
  );
}
