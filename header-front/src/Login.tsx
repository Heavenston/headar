import { Component, createSignal, For, Match, Show, Switch, useContext } from "solid-js";
import { GlobalStore } from "./App";

const Login: Component = () => {
  const store = useContext(GlobalStore);
  if (!store)
    return <></>;
  const [creating, setCreating] = createSignal(false);

  const createUser = (username: string) => {
    if (!confirm(`Do you really want to create user '${username}' ?`)) {
      return;
    }

    store.connection.reducers.createUser(username);
    setCreating(false);
  };

  const loginAs = (id: number) => {
    store.connection.reducers.connectToClient(id);
  };

  return <div class="min-h-screen flex justify-center items-center">
    <div class="bg-gray-100 w-2xs p-4 rounded shadow">
      <h1>Chose a user</h1>
      <hr class="my-1" />
      <ul>
        <For
          each={Object.values(store.users).filter(x => x != null)}
          children={(user, i) => {
            return <>
              <Show when={i() != 0}>
                <hr class="text-gray-200" />
              </Show>
              <li
                onClick={() => loginAs(user.id)}
                class="text-gray-700 hover:text-black transition py-0.5 hover:translate-x-2 cursor-pointer"
              >
                {user.username}
              </li>
            </>;
          }}
        />
        <hr class="text-transparent mt-1" />
        <li>
          <Switch>
            <Match when={!creating()}>
              <button
                class="transition w-full bg-gray-200 hover:bg-gray-300 cursor-pointer rounded"
                onClick={() => setCreating(true)}
              >
                Create
              </button>
            </Match>
            <Match when={creating()}>
              <form
                class="flex flex-row gap-4"
                onSubmit={(e) => {
                  e.preventDefault();

                  const h = e.currentTarget.firstChild;
                  if (h instanceof HTMLInputElement) {
                    createUser(h.value);
                  }
                }}
              >
                <input
                  name="username"
                  placeholder="username"
                  ref={e => { setTimeout(() => { e.focus(); }); }}
                  class="inline-block min-w-0 flex-grow rounded bg-gray-200 px-2"
                  onBlur={() => { setTimeout(() => setCreating(false), 250) }}
                />
                <button class="inline-block rounded bg-gray-200 px-2">
                  Confirm
                </button>
              </form>
            </Match>
          </Switch>
        </li>
      </ul>
    </div>
  </div>;
}

export default Login;
