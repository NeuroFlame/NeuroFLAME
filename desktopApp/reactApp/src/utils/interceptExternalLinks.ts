const interceptExternalLinks = () => {
  const handleLinkClick = (event: MouseEvent) => {
    const target = event.target as HTMLAnchorElement

    // Check if the clicked element is a link
    if (target.tagName === 'A' && target.href) {
      const isExternalLink = !target.href.startsWith(window.location.origin)

      if (isExternalLink) {
        event.preventDefault()

        // Open external link in a new window with specified position and size
        window.open(
          target.href,
          '_blank',
          'noopener,noreferrer,width=800,height=600,left=100,top=100',
        )
      }
    }
  }

  // Add event listener to capture all clicks on links
  document.addEventListener('click', handleLinkClick)

  // Return a cleanup function to remove the event listener when needed
  return () => {
    document.removeEventListener('click', handleLinkClick)
  }
}

export default interceptExternalLinks
