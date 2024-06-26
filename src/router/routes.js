const routes = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '/', component: () => import('pages/HomePage.vue') },
      { path: '/search', component: () => import('pages/SearchPage.vue') },
      { path: '/playlist/:playlistName', component: () => import('pages/PlaylistPage.vue') },
      { path: '/playlists', component: () => import('pages/PlaylistsPage.vue') },
      { path: '/history', component: () => import('pages/HistoryPage.vue') }
    ]
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    redirect: '/'
  }
]

export default routes
