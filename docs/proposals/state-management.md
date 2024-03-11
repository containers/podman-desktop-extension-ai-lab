# State management

The backend manages and persists the State. The backend pushes new state to the front-end 
when changes happen, and the front-end can ask for the current value of the state.

The front-end uses `readable` stores to expose the state to the different pages. The store 
listens for new states pushed by the backend (`onMessage`), and asks for the current state
at initial time.

The pages of the front-end subscribe to the store to get the value of the state in a reactive manner.

## ApplicationCatalog

The catalog is persisted as a file in the user's filesystem. The backend reads the file at startup,
and watches the file for changes. The backend updates the state as soon as changes it detects changes.

The front-end uses a `readable` store, which waits for changes on the ApplicationCatalog state 
(using `onMessage('new-catalog-state', data)`),
and asks for the current state at startup (with `postMessage('ask-catalog-state')`).

The interested pages of the front-end subscribe to the store to get the value
of the ApplicationCatalog state in a reactive manner.

## Pulled applications

The front-end initiates the pulling of an application (using `postMessage('pull-application', app-id)`). 

The backend manages and persists the state of the pulled applications and pushes every update
on the state (progression, etc.) (using `postMessage('new-pulled-application-state, app-id, data)`).

The front-end uses a `readable` store, which waits for changes on the Pulled Applications state
(using `onMessage('new-pulled-application-state)`), and asks for the current state at startup
(with `postMessage('ask-pulled-applications-state')`).

The interested pages of the front-end subscribe to the store to get the value of the Pulled Applications state
in a reactive manner.

## Errors

The front-end initiates operations (pull application, etc). When an error happens during an operation,
the backend manages and persists the error in a centralized way.

The backend pushes new errors (using `postMessage('new-error-state', data)`).
Optionally, it can push errors to the core Podman Desktop, to display errors in the notifications system.

The front-end uses a `readable` store, which waits for changes on the Errors state (using `onMessage('new-error-state')`),
and asks for the current state at startup (using `postMessage('ask-error-state)`).

The interested pages of the front-end subscribe to the store to display the errors related to the page.

The user can acknowledge an error (using a `postMessage('ack-error', id)`).

