set -euo pipefail

if [[ -f "../backend/.env" ]]; then
	echo "Loading environment from .env"

	set -a

	. ../backend/.env
	set +a
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-itms}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:-}"

# Hard fail DB_NAME doesn't match schema
if [[ "$DB_NAME" != "itms" ]]; then
	echo "Error: DB_NAME is set to '$DB_NAME', but schema.sql and seed.sql use 'itms'"
	echo "	Either set DB_NAME=itms in your .env, or update the SQL scripts to reflect the new name."

	exit 1
fi

for f in schema.sql routines.sql seed.sql; do
	if [[ ! -f "$f" ]]; then
		echo "ERROR: Required file '$f' not found in this directory."
		exit 1
	fi
done


# Build mysql command
MYSQL_CMD=(mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER")
if [[ -n "$DB_PASSWORD" ]]; then
	MYSQL_CMD+=(-p"$DB_PASSWORD")
fi

echo "Using MySQL Connection:"
echo "	Host: $DB_HOST"
echo "	Port: $DB_PORT"
echo "	User: $DB_USER"
echo "	DB: $DB_NAME"


# DROP EXISTING DB
echo "Dropping database '$DB_NAME' if it exists..."
"${MYSQL_CMD[@]}" -e "DROP DATABASE IF EXISTS \`$DB_NAME\`;"

# RECREATE SCHEMA
echo "Applying schema.sql..."
"${MYSQL_CMD[@]}" < schema.sql

# LOAD ROUTINES
echo "Applying routines.sql..."
"${MYSQL_CMD[@]}" "$DB_NAME" < routines.sql

# LOAD SEED DATA
echo "Applying seed.sql..."
"${MYSQL_CMD[@]}" "$DB_NAME" < seed.sql

echo "Done. Database '$DB_NAME' has been reset and reseeded."
