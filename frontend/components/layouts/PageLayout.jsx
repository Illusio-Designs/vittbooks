import Head from 'next/head';
import Breadcrumbs from '../ui/Breadcrumbs';

export default function PageLayout({
  children,
  title,
  breadcrumbs = [],
  actions,
  className = '',
}) {
  return (
    <>
      <Head>
        <title>{title ? `${title} - Fintranzact Admin` : 'Fintranzact Admin'}</title>
      </Head>
      <div className={`space-y-3 w-full max-w-full overflow-x-hidden ${className}`}>
        {/* Header with breadcrumbs and actions */}
        {(breadcrumbs.length > 0 || actions || title) && (
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-3 border-b border-gray-200 w-full">
            <div className="flex-1 min-w-0">
              {breadcrumbs.length > 0 && (
                <div className="mb-2">
                  <Breadcrumbs items={breadcrumbs} />
                </div>
              )}
              {title && (
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900 tracking-tight">
                  {title}
                </h1>
              )}
            </div>
            {actions && (
              <div className="flex items-center space-x-2 flex-shrink-0 w-full sm:w-auto">
                {actions}
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="w-full max-w-full overflow-x-hidden">
          {children}
        </div>
      </div>
    </>
  );
}

