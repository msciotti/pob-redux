//! Window calls that exist on desktop only. On iOS/Android they are no-ops, so the
//! pop-out windows' code compiles unchanged for both. Desktop behaviour is untouched.

use tauri::{Runtime, WebviewWindow, WebviewWindowBuilder};

pub trait WindowExt {
    fn unminimize(&self) -> tauri::Result<()>;
}

impl<R: Runtime> WindowExt for WebviewWindow<R> {
    fn unminimize(&self) -> tauri::Result<()> {
        #[cfg(desktop)]
        {
            WebviewWindow::unminimize(self)
        }
        #[cfg(not(desktop))]
        {
            Ok(())
        }
    }
}

pub trait BuilderExt: Sized {
    fn decorations(self, decorations: bool) -> Self;
    fn center(self) -> Self;
}

impl<'a, R: Runtime, M: tauri::Manager<R>> BuilderExt for WebviewWindowBuilder<'a, R, M> {
    fn decorations(self, decorations: bool) -> Self {
        #[cfg(desktop)]
        {
            WebviewWindowBuilder::decorations(self, decorations)
        }
        #[cfg(not(desktop))]
        {
            let _ = decorations;
            self
        }
    }

    fn center(self) -> Self {
        #[cfg(desktop)]
        {
            WebviewWindowBuilder::center(self)
        }
        #[cfg(not(desktop))]
        {
            self
        }
    }
}
