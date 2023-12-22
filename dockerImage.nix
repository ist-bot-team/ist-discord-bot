{ dockerTools, hello }:


dockerTools.buildImage {

  name = "hello-docker";

  config = {

    Cmd = [ "${hello}/bin/hello" ];
  };
}
