const NO_TRANSACTION_DIRECTIVE="-- migrate:no-transaction";

const splitStatements=(sql)=>sql
  .split(";")
  .map((statement)=>statement
    .split(/\r?\n/)
    .filter((line)=>line.trim()&&!line.trim().startsWith("--"))
    .join("\n")
    .trim())
  .filter(Boolean);

const concurrentIndexName=(statement)=>statement.match(/^CREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY\s+IF\s+NOT\s+EXISTS\s+([A-Za-z_][A-Za-z0-9_]*)\b/i)?.[1]||null;

const removeInvalidConcurrentIndex=async(client,indexName)=>{
  const result=await client.query(`
    SELECT (index_row.indisvalid AND index_row.indisready) AS is_valid
    FROM pg_class index_class
    JOIN pg_index index_row ON index_row.indexrelid=index_class.oid
    JOIN pg_namespace namespace ON namespace.oid=index_class.relnamespace
    WHERE namespace.nspname=current_schema() AND index_class.relname=$1
  `,[indexName]);
  if(result.rows?.[0]?.is_valid===false){
    await client.query(`DROP INDEX CONCURRENTLY IF EXISTS "${indexName}"`);
  }
};

export const executeMigration = async (client,name,sql) => {
  if(sql.trimStart().startsWith(NO_TRANSACTION_DIRECTIVE)){
    for(const statement of splitStatements(sql)){
      const indexName=concurrentIndexName(statement);
      if(indexName)await removeInvalidConcurrentIndex(client,indexName);
      await client.query(statement);
    }
    await client.query("INSERT INTO schema_migrations(name) VALUES($1)",[name]);
    return;
  }

  try{
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations(name) VALUES($1)",[name]);
    await client.query("COMMIT");
  }catch(error){
    await client.query("ROLLBACK");
    throw error;
  }
};
