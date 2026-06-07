{
  description = "Firestack — Firebase Cloud Functions (v2) CLI";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system: let
      pkgs = import nixpkgs { inherit system; };
    in {
      devShells.default = pkgs.mkShell {
        packages = with pkgs; [
          bun
          nodejs
          python3
          direnv
          nix-direnv
          jdk  # Firebase emulator requires Java
        ];

        shellHook = ''
          echo "🔥 Firestack  |  bun $(bun --version)  |  python $(python3 --version | cut -d' ' -f2)  |  java $(java --version 2>&1 | head -1 | cut -d' ' -f2)"
        '';
      };
    });
}
