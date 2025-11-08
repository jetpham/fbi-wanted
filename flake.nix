{
  description = "FBI Wanted API development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        bun = pkgs.bun;
      in {
        devShells.default = pkgs.mkShell {
          buildInputs = [ bun ];
        };
        
        packages = {
          inherit bun;
          default = bun;
        };
      }
    );
}
