FROM php:8.2-apache

# Install OS packages for PostgreSQL, then PDO and PostgreSQL extensions
RUN apt-get update && apt-get install -y libpq-dev && docker-php-ext-install pdo pdo_pgsql pgsql

# Enable Apache mod_rewrite for URL routing if needed
RUN a2enmod rewrite

# Update the default apache site with the config we created
# We want the DocumentRoot to be /var/www/html since our backend files will be there.
# Wait, the user has the monolithic repo, so the backend files are in `api/`.
# If Render builds from the root of the repo, everything goes to /var/www/html.
# The API will be accessible at YOUR_RENDER_URL/api/...
# Let's set DocumentRoot to the default /var/www/html

COPY . /var/www/html/

# Expose port 80
EXPOSE 80
