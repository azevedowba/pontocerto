# Ponto Certo

Aplicação estática para registro e acompanhamento da jornada de trabalho. O Ponto Certo ajuda a organizar as marcações do dia, acompanhar o tempo trabalhado e revisar os horários segundo um perfil configurável.

> O aplicativo avalia os horários conforme o perfil configurado pela pessoa. Ele não determina a interpretação de contratos, acordos coletivos ou legislação e não substitui orientação profissional ou jurídica.

## Funcionalidades

- Registro de entrada da manhã, saída para almoço, retorno do almoço e saída da tarde.
- Cálculo de tempo trabalhado, tempo restante, saldo, progresso e previsão de término.
- Validação da sequência das quatro batidas e destaque dos campos fora das regras ativas.
- Histórico: cada salvamento válido acrescenta um registro, inclusive quando já existe outro para a mesma data.
- Previsão de término e notificações do navegador, quando a pessoa permite notificações.
- Exportação do histórico em CSV.
- Extensão para Chrome/Edge com registro rápido dos horários e acesso ao histórico da aplicação web.

## Perfil inicial

O perfil inicial é editável em **Configurações**. Seus valores são parâmetros de partida, não uma declaração de que todas as empresas utilizam as mesmas regras.

| Regra | Valor inicial |
| --- | --- |
| Meta diária | 08:00 |
| Tolerância adicional | 10 minutos |
| Janela de entrada | 07:00–09:00 |
| Janela de saída | 17:00–19:00 |
| Período núcleo da manhã | 09:00–11:30 |
| Período núcleo da tarde | 14:00–17:00 |
| Intervalo de almoço | 30–150 minutos |
| Duração de cada turno | 180–300 minutos |

As quatro marcações e sua ordem cronológica são a estrutura fixa desta versão. As regras do perfil podem ser ativadas, desativadas e ajustadas; a meta diária continua obrigatória. O estado exibido indica aderência ao perfil, não uma certificação jurídica.

Cada registro salvo mantém uma cópia do perfil usado naquele momento. Alterar as configurações afeta os próximos cálculos e registros, sem reescrever o histórico anterior.

## Usar a aplicação web

A aplicação estática publicada está disponível em:

[https://azevedowba.github.io/pontocerto/](https://azevedowba.github.io/pontocerto/)

Use as abas **Hoje**, **Histórico** e **Configurações**. Na aba **Hoje**, registre as quatro batidas e use **Salvar Registro** para acrescentar o dia ao histórico. Cada clique válido cria um novo registro.

## Usar a extensão

1. Abra `chrome://extensions` no Chrome ou `edge://extensions` no Edge.
2. Ative o modo de desenvolvedor.
3. Escolha **Carregar sem compactação**.
4. Selecione a pasta raiz deste repositório, que contém `manifest.json`.
5. Abra o popup pelo ícone da extensão. Use o botão de configurações para editar o perfil local da extensão.

O botão **Histórico** abre a aplicação web na aba de histórico. Nesta versão, os registros e perfis salvos pela extensão e pela web ficam em armazenamentos locais separados; abrir a página web não copia os dados da extensão.

## Armazenamento e privacidade

A aplicação não exige conta ou backend. Os dados ficam no `localStorage` do respectivo contexto do navegador. A web e a extensão têm origens isoladas e, portanto, históricos e perfis independentes.

Chaves utilizadas:

- `ponto_history`: registros de jornada.
- `ponto_current_draft`: rascunho diário da extensão.
- `ponto_work_profile_v1`: perfil de jornada do contexto atual.

Os registros podem ser exportados em CSV pela interface. Remover os dados locais do navegador também remove os registros e o perfil daquele contexto.

## Estrutura do projeto

- `index.html`: aplicação web e navegação entre Hoje, Histórico e Configurações.
- `shared/js/time_core.js`: cálculos, perfil padrão e validações compartilhadas.
- `shared/js/work_profile_ui.js`: formulário reutilizado pela web e pela extensão.
- `shared/css/style.css`: tokens e estilos compartilhados.
- `shared/assets/ponto-certo-mark.svg`: marca usada nos cabeçalhos da web e do popup.
- `extension/popup/`: popup, estilos e persistência local da extensão.
- `extension/icons/`: ícones PNG em 16, 48 e 128 px usados pelo navegador.
- `extension/background/`: service worker da extensão.
- `manifest.json`: manifesto da extensão, na raiz do pacote.

## Desenvolvimento local

O projeto não usa gerenciador de pacotes ou etapa de build. Como a aplicação usa módulos JavaScript, é preferível acessá-la por um servidor estático local ou pela publicação web, em vez de abrir diretamente o arquivo com `file://`.
