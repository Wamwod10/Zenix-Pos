export const createTelegramReturnRefresh = ({isVisible,loadConnection,applyConnection}) => {
  let refreshing=false;
  return async()=>{
    if(refreshing||!isVisible())return false;
    refreshing=true;
    try{
      const connection=await loadConnection();
      if(connection?.connected)applyConnection(connection);
      return connection;
    }catch{
      return false;
    }finally{
      refreshing=false;
    }
  };
};
