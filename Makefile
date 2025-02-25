NAME = intrafix.zip
ZIP = zip

SRCS = $(wildcard src/*)

$(NAME): $(SRCS)
	$(ZIP) -r $@ $^
