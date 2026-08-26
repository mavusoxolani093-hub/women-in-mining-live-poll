const config = window.POLL_CONFIG;
const storageKey = `${config.pollId}:responses`;

function createId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readLocalResponses() {
  try {
    return JSON.parse(localStorage.getItem(storageKey) || "[]");
  } catch {
    return [];
  }
}

async function createLocalStore() {
  const channel = "BroadcastChannel" in window ? new BroadcastChannel(storageKey) : null;

  return {
    mode: "demo",
    async submit(response) {
      const saved = { id: createId(), ...response, created_at: new Date().toISOString() };
      const responses = readLocalResponses();
      responses.push(saved);
      localStorage.setItem(storageKey, JSON.stringify(responses));
      channel?.postMessage(saved);
      return saved;
    },
    async getAll() {
      return readLocalResponses();
    },
    subscribe(callback) {
      const receive = event => callback(event.data);
      const storageReceive = event => {
        if (event.key === storageKey) callback(null);
      };
      channel?.addEventListener("message", receive);
      window.addEventListener("storage", storageReceive);
      return () => {
        channel?.removeEventListener("message", receive);
        window.removeEventListener("storage", storageReceive);
      };
    }
  };
}

async function createSupabaseStore() {
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
  const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);

  return {
    mode: "live",
    async submit(response) {
      const { data, error } = await supabase
        .from("poll_responses")
        .insert(response)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    async getAll() {
      const { data, error } = await supabase
        .from("poll_responses")
        .select("id,poll_id,question_id,answer,created_at")
        .eq("poll_id", config.pollId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    subscribe(callback) {
      const channel = supabase
        .channel(`poll-${config.pollId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "poll_responses", filter: `poll_id=eq.${config.pollId}` },
          payload => callback(payload.new)
        )
        .subscribe();
      return () => supabase.removeChannel(channel);
    }
  };
}

export async function createResponseStore() {
  const hasSupabase = Boolean(config.supabaseUrl && config.supabaseAnonKey);
  return hasSupabase ? createSupabaseStore() : createLocalStore();
}
