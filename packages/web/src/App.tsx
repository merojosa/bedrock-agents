import { useQuery } from "@tanstack/react-query";
import React, { useEffect } from "react";

const promptKb = async (sessionId: string | undefined, text: string) => {
  const fetchResponse = await fetch(import.meta.env.VITE_APP_PROMPT_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: text,
      sessionId,
    }),
  });

  const fetchResponseJson = await fetchResponse.json();

  return fetchResponseJson as { sessionId: string; text: string };
};

function App() {
  const [sessionId, setSessionId] = React.useState<string>();
  const [currentUserText, setCurrentUserText] = React.useState("");
  const [texts, setTexts] = React.useState([] as string[]);

  const prompt = useQuery({
    queryKey: ["prompt", texts],
    queryFn: () => {
      if (texts.length) {
        return promptKb(sessionId, texts[texts.length - 1]);
      }
      return null;
    },
    enabled: !!currentUserText || texts.length > 0,
    refetchOnMount: false,
    retryOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (prompt.data) {
      setSessionId(prompt.data.sessionId);
    }
  }, [prompt.data]);

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <p>Current session: {sessionId}</p>

      <div>
        <input
          value={currentUserText}
          onChange={(event) => setCurrentUserText(event.target.value)}
        />
        <button
          onClick={() => {
            setTexts([...texts, currentUserText]);
            setCurrentUserText("");
          }}
          disabled={prompt.isFetching}
        >
          Submit
        </button>
      </div>

      <p style={{ margin: 0 }}>{texts[texts.length - 1]}</p>
      <p style={{ margin: 0 }}>{prompt.data?.text}</p>
      {prompt.isFetching && <p>Loading...</p>}
    </div>
  );
}

export default App;
